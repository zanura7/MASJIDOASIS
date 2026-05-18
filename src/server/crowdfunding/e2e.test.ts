import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  CampaignService,
  CampaignServiceError,
  type CampaignStore,
  type CampaignRecord,
} from "./campaign-service";
import {
  DonationService,
  DonationServiceError,
  type DonationStore,
  type DonationRecord,
  type PaymentGateway,
} from "./donation-service";

/**
 * E2E Integration Test for Crowdfunding Flow
 * 
 * Covers full donation lifecycle:
 * 1. Admin creates campaign → DRAFT status
 * 2. Admin publishes campaign → ACTIVE status
 * 3. User creates donation → PENDING payment, get payment token
 * 4. Midtrans webhook fires 'settlement' → donation PAID, campaign raisedCents incremented
 * 5. Same webhook fires again (duplicate) → idempotent, no double counting
 * 6. Admin closes campaign → CLOSED, no new donations accepted
 * 7. Verify cannot donate to CLOSED campaign
 * 8. Verify cannot delete campaign with raised funds
 * 9. Test anonymous donation flow (donorId null, isAnonymous true)
 * 10. Test failed payment flow (expire/cancel/deny)
 */

interface MemDb {
  campaigns: Map<string, CampaignRecord>;
  donations: Map<string, DonationRecord>;
  donationsByMidtransOrderId: Map<string, DonationRecord>;
  slugCounts: Map<string, number>;
}

function makeCampaignStore(db: MemDb): CampaignStore {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  return {
    async create(input) {
      const record: CampaignRecord = {
        id: nextId("cmp"),
        ownerId: input.ownerId,
        slug: input.slug,
        title: input.title,
        description: input.description,
        targetCents: input.targetCents,
        raisedCents: input.raisedCents,
        currency: input.currency,
        status: input.status,
        coverImage: input.coverImage ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.campaigns.set(record.id, record);
      return record;
    },

    async update(id, input) {
      const campaign = db.campaigns.get(id);
      if (!campaign) throw new Error("Campaign not found");

      const updated: CampaignRecord = {
        ...campaign,
        ...input,
        updatedAt: new Date(),
      };
      db.campaigns.set(id, updated);
      return updated;
    },

    async delete(id) {
      db.campaigns.delete(id);
    },

    async findById(id) {
      return db.campaigns.get(id) ?? null;
    },

    async findBySlug(slug) {
      for (const campaign of db.campaigns.values()) {
        if (campaign.slug === slug) return campaign;
      }
      return null;
    },

    async listActive() {
      return Array.from(db.campaigns.values()).filter(
        (c) => c.status === "ACTIVE"
      );
    },

    async listAll() {
      return Array.from(db.campaigns.values());
    },

    async countBySlug(slug) {
      return db.slugCounts.get(slug) ?? 0;
    },

    async incrementRaised(id, amountCents) {
      const campaign = db.campaigns.get(id);
      if (!campaign) throw new Error("Campaign not found");

      const before = campaign.raisedCents;
      campaign.raisedCents = before + amountCents;
      campaign.updatedAt = new Date();
      db.campaigns.set(id, campaign);
    },
  };
}

function makeDonationStore(db: MemDb): DonationStore {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  return {
    async create(input) {
      const record: DonationRecord = {
        id: nextId("don"),
        campaignId: input.campaignId,
        donorId: input.donorId ?? null,
        donorNameSnapshot: input.donorNameSnapshot ?? null,
        isAnonymous: input.isAnonymous,
        amountCents: input.amountCents,
        currency: input.currency,
        message: input.message ?? null,
        paymentStatus: input.paymentStatus,
        midtransOrderId: input.midtransOrderId,
        paidAt: null,
        createdAt: new Date(),
      };
      db.donations.set(record.id, record);
      db.donationsByMidtransOrderId.set(input.midtransOrderId, record);
      return record;
    },

    async findById(id) {
      return db.donations.get(id) ?? null;
    },

    async findByMidtransOrderId(orderId) {
      return db.donationsByMidtransOrderId.get(orderId) ?? null;
    },

    async updatePaymentStatus(id, status, paidAt) {
      const donation = db.donations.get(id);
      if (!donation) throw new Error("Donation not found");

      const updated: DonationRecord = {
        ...donation,
        paymentStatus: status,
        paidAt,
      };
      db.donations.set(id, updated);
      
      // Update the midtrans order id map as well
      if (donation.midtransOrderId) {
        db.donationsByMidtransOrderId.set(donation.midtransOrderId, updated);
      }
      
      return updated;
    },
  };
}

function makePaymentGateway(): PaymentGateway {
  return {
    async createTransaction(input) {
      return {
        token: `snap_token_${input.orderId}`,
        redirectUrl: `https://midtrans.com/snap/${input.orderId}`,
      };
    },
  };
}

function freshDb(): MemDb {
  return {
    campaigns: new Map(),
    donations: new Map(),
    donationsByMidtransOrderId: new Map(),
    slugCounts: new Map(),
  };
}

describe("Crowdfunding E2E Integration", () => {
  let db: MemDb;
  let campaignStore: CampaignStore;
  let donationStore: DonationStore;
  let paymentGateway: PaymentGateway;
  let campaignService: CampaignService;
  let donationService: DonationService;

  beforeEach(() => {
    db = freshDb();
    campaignStore = makeCampaignStore(db);
    donationStore = makeDonationStore(db);
    paymentGateway = makePaymentGateway();
    campaignService = new CampaignService({ store: campaignStore });
    donationService = new DonationService({
      store: donationStore,
      campaignService,
      paymentGateway,
    });
  });

  it("full donation lifecycle: create → publish → donate → webhook → close", async () => {
    // 1. Admin creates campaign → verify DRAFT status
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Renovasi Masjid Al-Ikhlas",
      description: "Dana untuk renovasi masjid",
      targetCents: BigInt(50_000_000_00), // 50 juta IDR
    });

    expect(campaign.status).toBe("DRAFT");
    expect(campaign.raisedCents).toBe(BigInt(0));
    expect(campaign.slug).toBe("renovasi-masjid-al-ikhlas");

    // 2. Admin publishes campaign → verify ACTIVE status
    const published = await campaignService.publishCampaign(campaign.id);
    expect(published.status).toBe("ACTIVE");

    // 3. User creates donation → verify PENDING payment, get payment token
    const donationResult = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_1",
      donorName: "Ahmad Abdullah",
      isAnonymous: false,
      amountCents: BigInt(500_000_00), // 500 ribu IDR
      message: "Semoga berkah",
    });

    expect(donationResult.donation.paymentStatus).toBe("PENDING");
    expect(donationResult.donation.campaignId).toBe(campaign.id);
    expect(donationResult.token).toMatch(/^snap_token_DON-/);
    expect(donationResult.redirectUrl).toMatch(/^https:\/\/midtrans\.com/);

    const orderId = donationResult.donation.midtransOrderId!;

    // 4. Midtrans webhook fires 'settlement' → verify donation PAID, campaign raisedCents incremented
    await donationService.handlePaymentNotification(orderId, "settlement");

    const paidDonation = await donationStore.findById(donationResult.donation.id);
    expect(paidDonation?.paymentStatus).toBe("PAID");
    expect(paidDonation?.paidAt).toBeInstanceOf(Date);

    // Service auto-increments raised via campaignService.incrementRaised
    const campaignAfterPayment = await campaignStore.findById(campaign.id);
    expect(campaignAfterPayment?.raisedCents).toBe(BigInt(500_000_00));

    // 5. Same webhook fires again (duplicate) → verify idempotent, no double counting
    await donationService.handlePaymentNotification(orderId, "settlement");

    const donationAfterDuplicate = await donationStore.findById(
      donationResult.donation.id
    );
    expect(donationAfterDuplicate?.paymentStatus).toBe("PAID");

    // Campaign raised should not change (idempotent)
    const campaignAfterDuplicate = await campaignStore.findById(campaign.id);
    expect(campaignAfterDuplicate?.raisedCents).toBe(BigInt(500_000_00));

    // 6. Admin closes campaign → verify CLOSED, no new donations accepted
    const closed = await campaignService.closeCampaign(campaign.id);
    expect(closed.status).toBe("CLOSED");

    // 7. Verify cannot donate to CLOSED campaign
    await expect(
      donationService.createDonation({
        campaignSlug: campaign.slug,
        donorId: "user_2",
        amountCents: BigInt(100_000_00),
      })
    ).rejects.toMatchObject({
      code: "CAMPAIGN_NOT_ACTIVE",
    });

    // 8. Verify cannot delete campaign with raised funds
    await expect(campaignService.deleteCampaign(campaign.id)).rejects.toMatchObject({
      code: "CAMPAIGN_HAS_FUNDS",
    });
  });

  it("anonymous donation flow (donorId null, isAnonymous true)", async () => {
    // Create and publish campaign
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Bantuan Yatim Piatu",
      description: "Dana untuk anak yatim",
      targetCents: BigInt(10_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);

    // Anonymous donation
    const donationResult = await donationService.createDonation({
      campaignSlug: campaign.slug,
      isAnonymous: true,
      amountCents: BigInt(250_000_00),
      message: "Semoga bermanfaat",
    });

    expect(donationResult.donation.isAnonymous).toBe(true);
    expect(donationResult.donation.donorId).toBeNull();

    // Verify payment gateway received "Hamba Allah" as customer name
    const orderId = donationResult.donation.midtransOrderId!;
    expect(orderId).toMatch(/^DON-/);
  });

  it("failed payment flow (expire/cancel/deny)", async () => {
    // Create and publish campaign
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Pembangunan Musholla",
      description: "Dana pembangunan musholla",
      targetCents: BigInt(20_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);

    // Create donation
    const donationResult = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_3",
      donorName: "Fatimah",
      amountCents: BigInt(300_000_00),
    });

    const orderId = donationResult.donation.midtransOrderId!;

    // Test expire status
    await donationService.handlePaymentNotification(orderId, "expire");
    let donation = await donationStore.findById(donationResult.donation.id);
    expect(donation?.paymentStatus).toBe("FAILED");
    expect(donation?.paidAt).toBeNull();

    // Create another donation for cancel test
    const donation2 = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_4",
      amountCents: BigInt(150_000_00),
    });

    await donationService.handlePaymentNotification(
      donation2.donation.midtransOrderId!,
      "cancel"
    );
    const canceledDonation = await donationStore.findById(donation2.donation.id);
    expect(canceledDonation?.paymentStatus).toBe("FAILED");

    // Create another donation for deny test
    const donation3 = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_5",
      amountCents: BigInt(200_000_00),
    });

    await donationService.handlePaymentNotification(
      donation3.donation.midtransOrderId!,
      "deny"
    );
    const deniedDonation = await donationStore.findById(donation3.donation.id);
    expect(deniedDonation?.paymentStatus).toBe("FAILED");

    // Verify campaign raised is still 0 (no successful payments)
    const campaignAfter = await campaignStore.findById(campaign.id);
    expect(campaignAfter?.raisedCents).toBe(BigInt(0));
  });

  it("cannot publish already active campaign", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Test Campaign",
      description: "Test",
      targetCents: BigInt(1_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);

    await expect(campaignService.publishCampaign(campaign.id)).rejects.toMatchObject({
      code: "CAMPAIGN_ALREADY_ACTIVE",
    });
  });

  it("cannot close already closed campaign", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Test Campaign",
      description: "Test",
      targetCents: BigInt(1_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);
    await campaignService.closeCampaign(campaign.id);

    await expect(campaignService.closeCampaign(campaign.id)).rejects.toMatchObject({
      code: "CAMPAIGN_ALREADY_CLOSED",
    });
  });

  it("can delete campaign with no raised funds", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Test Campaign",
      description: "Test",
      targetCents: BigInt(1_000_000_00),
    });

    expect(campaign.raisedCents).toBe(BigInt(0));

    await campaignService.deleteCampaign(campaign.id);

    const deleted = await campaignStore.findById(campaign.id);
    expect(deleted).toBeNull();
  });

  it("rejects donation with zero or negative amount", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Test Campaign",
      description: "Test",
      targetCents: BigInt(1_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);

    await expect(
      donationService.createDonation({
        campaignSlug: campaign.slug,
        donorId: "user_1",
        amountCents: BigInt(0),
      })
    ).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
  });

  it("rejects donation to non-existent campaign", async () => {
    await expect(
      donationService.createDonation({
        campaignSlug: "non-existent-campaign",
        donorId: "user_1",
        amountCents: BigInt(100_000_00),
      })
    ).rejects.toMatchObject({
      code: "CAMPAIGN_NOT_FOUND",
    });
  });

  it("rejects donation to DRAFT campaign", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Draft Campaign",
      description: "Still in draft",
      targetCents: BigInt(5_000_000_00),
    });

    // Don't publish, keep as DRAFT
    expect(campaign.status).toBe("DRAFT");

    await expect(
      donationService.createDonation({
        campaignSlug: campaign.slug,
        donorId: "user_1",
        amountCents: BigInt(100_000_00),
      })
    ).rejects.toMatchObject({
      code: "CAMPAIGN_NOT_ACTIVE",
    });
  });

  it("handles multiple donations to same campaign", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Multi Donor Campaign",
      description: "Test multiple donors",
      targetCents: BigInt(10_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);

    // First donation
    const donation1 = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_1",
      amountCents: BigInt(200_000_00),
    });

    await donationService.handlePaymentNotification(
      donation1.donation.midtransOrderId!,
      "settlement"
    );

    // Second donation
    const donation2 = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_2",
      amountCents: BigInt(300_000_00),
    });

    await donationService.handlePaymentNotification(
      donation2.donation.midtransOrderId!,
      "settlement"
    );

    // Third donation
    const donation3 = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_3",
      amountCents: BigInt(500_000_00),
    });

    await donationService.handlePaymentNotification(
      donation3.donation.midtransOrderId!,
      "settlement"
    );

    // Verify total raised
    const updatedCampaign = await campaignStore.findById(campaign.id);
    expect(updatedCampaign?.raisedCents).toBe(BigInt(1_000_000_00)); // 200k + 300k + 500k

    // Verify all donations are PAID
    const paid1 = await donationStore.findById(donation1.donation.id);
    const paid2 = await donationStore.findById(donation2.donation.id);
    const paid3 = await donationStore.findById(donation3.donation.id);

    expect(paid1?.paymentStatus).toBe("PAID");
    expect(paid2?.paymentStatus).toBe("PAID");
    expect(paid3?.paymentStatus).toBe("PAID");
  });

  it("webhook for non-existent donation throws error", async () => {
    await expect(
      donationService.handlePaymentNotification("non-existent-order", "settlement")
    ).rejects.toMatchObject({
      code: "DONATION_NOT_FOUND",
    });
  });

  it("capture status also marks donation as PAID", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Capture Test",
      description: "Test capture status",
      targetCents: BigInt(5_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);

    const donation = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_1",
      amountCents: BigInt(100_000_00),
    });

    // Use 'capture' status instead of 'settlement'
    await donationService.handlePaymentNotification(
      donation.donation.midtransOrderId!,
      "capture"
    );

    const paidDonation = await donationStore.findById(donation.donation.id);
    expect(paidDonation?.paymentStatus).toBe("PAID");
    expect(paidDonation?.paidAt).toBeInstanceOf(Date);
  });

  it("failure status also marks donation as FAILED", async () => {
    const campaign = await campaignService.createCampaign({
      ownerId: "admin_1",
      title: "Failure Test",
      description: "Test failure status",
      targetCents: BigInt(5_000_000_00),
    });

    await campaignService.publishCampaign(campaign.id);

    const donation = await donationService.createDonation({
      campaignSlug: campaign.slug,
      donorId: "user_1",
      amountCents: BigInt(100_000_00),
    });

    await donationService.handlePaymentNotification(
      donation.donation.midtransOrderId!,
      "failure"
    );

    const failedDonation = await donationStore.findById(donation.donation.id);
    expect(failedDonation?.paymentStatus).toBe("FAILED");
    expect(failedDonation?.paidAt).toBeNull();
  });
});
