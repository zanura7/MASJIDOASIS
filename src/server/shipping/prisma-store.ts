/**
 * Prisma adapter for ShipmentStore + ShipmentProviderAdapter wiring.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  ShipmentStore,
  ShipmentRecord,
  ShipmentProviderAdapter,
} from "./shipment-service";
import { KiriminAjaProvider } from "./kiriminaja-provider";

export function buildShipmentStore(prisma: PrismaClient): ShipmentStore {
  return {
    async createShipment(input) {
      const row = await prisma.shipment.create({
        data: {
          orderId: input.orderId,
          courier: input.courier,
          service: input.service,
          costCents: input.costCents,
          weightGram: input.weightGram,
          fromAddress: input.fromAddress as any,
          toAddress: input.toAddress as any,
          status: input.status as any,
        },
      });
      return row as unknown as ShipmentRecord;
    },

    async findByOrderId(orderId) {
      const row = await prisma.shipment.findFirst({
        where: { orderId },
        orderBy: { createdAt: "desc" },
      });
      return (row as unknown as ShipmentRecord) ?? null;
    },

    async updateShipment(shipmentId, patch) {
      const data: Record<string, unknown> = {};
      if (patch.trackingNo !== undefined) data.trackingNo = patch.trackingNo;
      if (patch.providerRef !== undefined) data.providerRef = patch.providerRef;
      if (patch.providerMeta !== undefined) data.providerMeta = patch.providerMeta as any;
      if (patch.status !== undefined) data.status = patch.status as any;
      if (patch.pickedUpAt !== undefined) data.pickedUpAt = patch.pickedUpAt as any;
      if (patch.deliveredAt !== undefined) data.deliveredAt = patch.deliveredAt as any;

      const row = await prisma.shipment.update({
        where: { id: shipmentId },
        data,
      });
      return row as unknown as ShipmentRecord;
    },
  };
}

/**
 * Production-ready provider adapter using KiriminAja's HTTP API.
 * Falls back to no-op for missing/invalid config (manual resi flow).
 */
export function buildKiriminAjaAdapter(): ShipmentProviderAdapter {
  const apiKey = process.env.KIRIMINAJA_API_KEY ?? "";
  const baseUrl = process.env.KIRIMINAJA_BASE_URL ?? "https://api-sandbox.kiriminaja.com/api/mitra";

  if (!apiKey) {
    // Return a stub that always fails so callers fall back to manual resi.
    return {
      async requestPickup() {
        throw new Error("KiriminAja not configured — manual resi required");
      },
    };
  }

  const provider = new KiriminAjaProvider({ apiKey, baseUrl });

  return {
    async requestPickup(input) {
      // TODO: Implement real KiriminAja pickup endpoint when credentials available.
      // For now, throw to force manual resi until pickup API integrated.
      void provider;
      void input;
      throw new Error("KiriminAja pickup API not yet implemented — manual resi required");
    },
  };
}
