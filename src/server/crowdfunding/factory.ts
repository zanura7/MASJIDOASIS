import { prisma } from "@/server/db";

import { CampaignService } from "./campaign-service";
import { DonationService } from "./donation-service";
import { buildCampaignStore, buildDonationStore } from "./prisma-store";
import { MidtransPaymentGateway } from "./midtrans-gateway";

export function buildCampaignService(): CampaignService {
  return new CampaignService({
    store: buildCampaignStore(prisma),
  });
}

export function buildDonationService(): DonationService {
  return new DonationService({
    store: buildDonationStore(prisma),
    campaignService: buildCampaignService(),
    paymentGateway: new MidtransPaymentGateway(),
  });
}

// Aliases for API route compatibility
export const makeCampaignService = buildCampaignService;
export const makeDonationService = buildDonationService;
