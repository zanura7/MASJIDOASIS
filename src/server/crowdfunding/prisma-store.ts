import type { PrismaClient } from "@prisma/client";
import type { CampaignStore, CampaignRecord, CampaignStatus } from "./campaign-service";
import type { DonationStore, DonationRecord, PaymentStatus } from "./donation-service";

export function buildCampaignStore(prisma: PrismaClient): CampaignStore {
  return {
    async create(input) {
      const row = await prisma.campaign.create({
        data: {
          ownerId: input.ownerId,
          slug: input.slug,
          title: input.title,
          description: input.description,
          targetCents: input.targetCents,
          raisedCents: input.raisedCents,
          currency: input.currency,
          status: input.status as any,
          coverImage: input.coverImage,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
      });
      return row as unknown as CampaignRecord;
    },

    async update(id, patch) {
      const data: Record<string, unknown> = {};
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.targetCents !== undefined) data.targetCents = patch.targetCents;
      if (patch.coverImage !== undefined) data.coverImage = patch.coverImage;
      if (patch.startsAt !== undefined) data.startsAt = patch.startsAt;
      if (patch.endsAt !== undefined) data.endsAt = patch.endsAt;
      if (patch.status !== undefined) data.status = patch.status as any;

      const row = await prisma.campaign.update({
        where: { id },
        data,
      });
      return row as unknown as CampaignRecord;
    },

    async delete(id) {
      await prisma.campaign.delete({ where: { id } });
    },

    async findById(id) {
      const row = await prisma.campaign.findUnique({
        where: { id },
        include: { owner: { select: { name: true } } },
      });
      return (row as unknown as CampaignRecord) ?? null;
    },

    async findBySlug(slug) {
      const row = await prisma.campaign.findUnique({
        where: { slug },
        include: { owner: { select: { name: true } } },
      });
      return (row as unknown as CampaignRecord) ?? null;
    },

    async listActive() {
      const rows = await prisma.campaign.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { name: true } } },
      });
      return rows as unknown as CampaignRecord[];
    },

    async listAll() {
      const rows = await prisma.campaign.findMany({
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { name: true } } },
      });
      return rows as unknown as CampaignRecord[];
    },

    async countBySlug(slug) {
      return prisma.campaign.count({ where: { slug } });
    },

    async incrementRaised(id, amountCents) {
      await prisma.campaign.update({
        where: { id },
        data: {
          raisedCents: { increment: amountCents },
        },
      });
    },
  };
}

export function buildDonationStore(prisma: PrismaClient): DonationStore {
  return {
    async create(input) {
      const row = await prisma.donation.create({
        data: {
          campaignId: input.campaignId,
          donorId: input.donorId,
          donorNameSnapshot: input.donorNameSnapshot,
          isAnonymous: input.isAnonymous,
          amountCents: input.amountCents,
          currency: input.currency,
          message: input.message,
          paymentStatus: input.paymentStatus as any,
          midtransOrderId: input.midtransOrderId,
        },
      });
      return row as unknown as DonationRecord;
    },

    async findById(id) {
      const row = await prisma.donation.findUnique({ where: { id } });
      return (row as unknown as DonationRecord) ?? null;
    },

    async findByMidtransOrderId(midtransOrderId) {
      const row = await prisma.donation.findUnique({ where: { midtransOrderId } });
      return (row as unknown as DonationRecord) ?? null;
    },

    async updatePaymentStatus(id, status, paidAt) {
      const row = await prisma.donation.update({
        where: { id },
        data: {
          paymentStatus: status as any,
          paidAt: paidAt,
        },
      });
      return row as unknown as DonationRecord;
    },

    async listByCampaignId(campaignId) {
      const rows = await prisma.donation.findMany({
        where: { campaignId, paymentStatus: "PAID" as any },
        orderBy: { paidAt: "desc" },
      });
      return rows as unknown as DonationRecord[];
    },
  };
}
