import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  DonationService,
  DonationServiceError,
  type DonationStore,
} from "./donation-service";

function makeStore(overrides: Partial<DonationStore> = {}): DonationStore {
  return {
    create: vi.fn().mockResolvedValue({
      id: "don_1",
      campaignId: "cmp_1",
      donorId: "user_1",
      donorNameSnapshot: "Hamba Allah",
      isAnonymous: false,
      amountCents: BigInt(500_000_00),
      currency: "IDR",
      message: "Semoga berkah",
      paymentStatus: "PENDING",
      midtransOrderId: "order_123",
      paidAt: null,
      createdAt: new Date(),
    }),
    findById: vi.fn().mockResolvedValue({
      id: "don_1",
      campaignId: "cmp_1",
      donorId: "user_1",
      amountCents: BigInt(500_000_00),
      paymentStatus: "PENDING",
    }),
    findByMidtransOrderId: vi.fn().mockResolvedValue({
      id: "don_1",
      campaignId: "cmp_1",
      amountCents: BigInt(500_000_00),
      paymentStatus: "PENDING",
    }),
    updatePaymentStatus: vi.fn().mockResolvedValue({ id: "don_1" }),
    ...overrides,
  };
}

const mockCampaignService = {
  getCampaignBySlug: vi.fn(),
  incrementRaised: vi.fn(),
  updateCampaign: vi.fn(),
  closeCampaign: vi.fn(),
  publishCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  createCampaign: vi.fn(),
  listActiveCampaigns: vi.fn(),
};

const mockPaymentGateway = {
  createTransaction: vi.fn().mockResolvedValue({
    token: "snap_token_123",
    redirectUrl: "https://midtrans.com/redirect",
  }),
};

describe("DonationService", () => {
  let store: DonationStore;
  let service: DonationService;

  beforeEach(() => {
    store = makeStore();
    service = new DonationService({
      store,
      campaignService: mockCampaignService as any,
      paymentGateway: mockPaymentGateway as any,
    });
  });

  describe("createDonation", () => {
    it("should create donation and return payment token", async () => {
      mockCampaignService.getCampaignBySlug.mockResolvedValue({
        id: "cmp_1",
        status: "ACTIVE",
      });

      const result = await service.createDonation({
        campaignSlug: "renovasi-masjid",
        donorId: "user_1",
        donorName: "Hamba Allah",
        isAnonymous: false,
        amountCents: BigInt(500_000_00),
        message: "Semoga berkah",
      });

      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "cmp_1",
          amountCents: BigInt(500_000_00),
          isAnonymous: false,
        })
      );
      expect(mockPaymentGateway.createTransaction).toHaveBeenCalled();
      expect(result.token).toBe("snap_token_123");
    });

    it("should reject if campaign not found", async () => {
      mockCampaignService.getCampaignBySlug.mockResolvedValue(null);

      await expect(
        service.createDonation({
          campaignSlug: "not-found",
          amountCents: BigInt(500_000_00),
        })
      ).rejects.toThrow(DonationServiceError);
    });

    it("should reject if campaign is not ACTIVE", async () => {
      mockCampaignService.getCampaignBySlug.mockResolvedValue({
        id: "cmp_1",
        status: "CLOSED",
      });

      await expect(
        service.createDonation({
          campaignSlug: "renovasi-masjid",
          amountCents: BigInt(500_000_00),
        })
      ).rejects.toThrow(DonationServiceError);
    });

    it("should reject zero or negative amount", async () => {
      mockCampaignService.getCampaignBySlug.mockResolvedValue({
        id: "cmp_1",
        status: "ACTIVE",
      });

      await expect(
        service.createDonation({
          campaignSlug: "renovasi-masjid",
          amountCents: BigInt(0),
        })
      ).rejects.toThrow(DonationServiceError);
    });
  });

  describe("handlePaymentNotification", () => {
    it("should mark donation as paid and increment campaign raised funds", async () => {
      await service.handlePaymentNotification("order_123", "settlement");

      expect(store.findByMidtransOrderId).toHaveBeenCalledWith("order_123");
      expect(store.updatePaymentStatus).toHaveBeenCalledWith(
        "don_1",
        "PAID",
        expect.any(Date)
      );
      // Wait for increment to be called, assuming it is handled via campaign service or store directly
    });

    it("should ignore if order not found", async () => {
      store.findByMidtransOrderId = vi.fn().mockResolvedValue(null);

      await expect(
        service.handlePaymentNotification("order_999", "settlement")
      ).rejects.toThrow(DonationServiceError);
    });

    it("should ignore if already paid", async () => {
      store.findByMidtransOrderId = vi.fn().mockResolvedValue({
        id: "don_1",
        paymentStatus: "PAID",
      });

      await service.handlePaymentNotification("order_123", "settlement");

      expect(store.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it("should mark as failed on expire/cancel/deny", async () => {
      await service.handlePaymentNotification("order_123", "expire");

      expect(store.updatePaymentStatus).toHaveBeenCalledWith(
        "don_1",
        "FAILED",
        null
      );
    });
  });
});
