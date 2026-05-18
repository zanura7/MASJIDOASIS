import type { CampaignService } from "./campaign-service";

export class DonationServiceError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "DonationServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type PaymentStatus = "PENDING" | "PAID" | "FAILED";

export interface DonationRecord {
  id: string;
  campaignId: string;
  donorId?: string | null;
  donorNameSnapshot?: string | null;
  isAnonymous: boolean;
  amountCents: bigint;
  currency: string;
  message?: string | null;
  paymentStatus: PaymentStatus;
  midtransOrderId?: string | null;
  paidAt?: Date | null;
  createdAt?: Date;
  [key: string]: unknown;
}

export interface CreateDonationInput {
  campaignSlug: string;
  donorId?: string;
  donorName?: string;
  isAnonymous?: boolean;
  amountCents: bigint;
  message?: string;
}

export interface DonationStore {
  create(input: {
    campaignId: string;
    donorId?: string;
    donorNameSnapshot?: string;
    isAnonymous: boolean;
    amountCents: bigint;
    currency: string;
    message?: string;
    paymentStatus: PaymentStatus;
    midtransOrderId: string;
  }): Promise<DonationRecord>;

  findById(id: string): Promise<DonationRecord | null>;
  findByMidtransOrderId(orderId: string): Promise<DonationRecord | null>;
  updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    paidAt: Date | null
  ): Promise<DonationRecord>;
  listByCampaignId?(campaignId: string): Promise<DonationRecord[]>;
}

export interface PaymentGateway {
  createTransaction(input: {
    orderId: string;
    amountCents: bigint;
    customerDetails?: {
      firstName?: string;
      email?: string;
    };
  }): Promise<{ token: string; redirectUrl: string }>;
}

export class DonationService {
  private store: DonationStore;
  private campaignService: CampaignService;
  private paymentGateway: PaymentGateway;

  constructor({
    store,
    campaignService,
    paymentGateway,
  }: {
    store: DonationStore;
    campaignService: CampaignService;
    paymentGateway: PaymentGateway;
  }) {
    this.store = store;
    this.campaignService = campaignService;
    this.paymentGateway = paymentGateway;
  }

  async createDonation(
    input: CreateDonationInput
  ): Promise<{ donation: DonationRecord; token: string; redirectUrl: string }> {
    if (input.amountCents <= BigInt(0)) {
      throw new DonationServiceError(
        "INVALID_AMOUNT",
        400,
        "Amount must be greater than zero"
      );
    }

    const campaign = await this.campaignService.getCampaignBySlug(
      input.campaignSlug
    );

    if (!campaign) {
      throw new DonationServiceError(
        "CAMPAIGN_NOT_FOUND",
        404,
        "Campaign not found"
      );
    }

    if (campaign.status !== "ACTIVE") {
      throw new DonationServiceError(
        "CAMPAIGN_NOT_ACTIVE",
        400,
        "Campaign is not active"
      );
    }

    // Generate unique order ID
    const orderId = `DON-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create payment transaction
    const payment = await this.paymentGateway.createTransaction({
      orderId,
      amountCents: input.amountCents,
      customerDetails: {
        firstName: input.isAnonymous ? "Hamba Allah" : input.donorName,
      },
    });

    // Save donation record
    const donation = await this.store.create({
      campaignId: campaign.id,
      donorId: input.donorId,
      donorNameSnapshot: input.donorName,
      isAnonymous: input.isAnonymous ?? false,
      amountCents: input.amountCents,
      currency: "IDR",
      message: input.message,
      paymentStatus: "PENDING",
      midtransOrderId: orderId,
    });

    return {
      donation,
      token: payment.token,
      redirectUrl: payment.redirectUrl,
    };
  }

  async handlePaymentNotification(
    orderId: string,
    transactionStatus: string
  ): Promise<void> {
    const donation = await this.store.findByMidtransOrderId(orderId);

    if (!donation) {
      throw new DonationServiceError(
        "DONATION_NOT_FOUND",
        404,
        "Donation not found"
      );
    }

    if (donation.paymentStatus === "PAID") {
      // Idempotent: already paid, do nothing
      return;
    }

    if (
      transactionStatus === "settlement" ||
      transactionStatus === "capture"
    ) {
      await this.store.updatePaymentStatus(donation.id, "PAID", new Date());
      // Increment raised cents on campaign
      await this.campaignService.incrementRaised(
        donation.campaignId,
        donation.amountCents
      );
    } else if (
      transactionStatus === "deny" ||
      transactionStatus === "cancel" ||
      transactionStatus === "expire" ||
      transactionStatus === "failure"
    ) {
      await this.store.updatePaymentStatus(donation.id, "FAILED", null);
    }
  }

  async listDonationsByCampaign(campaignId: string): Promise<DonationRecord[]> {
    if (!this.store.listByCampaignId) {
      throw new Error("Store does not support listByCampaignId");
    }
    return this.store.listByCampaignId(campaignId);
  }
}
