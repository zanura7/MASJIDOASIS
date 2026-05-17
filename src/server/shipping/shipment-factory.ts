import { prisma } from "@/server/db";
import { ShipmentService } from "./shipment-service";
import { buildKiriminAjaAdapter, buildShipmentStore } from "./prisma-store";

export function buildShipmentService(): ShipmentService {
  return new ShipmentService({
    store: buildShipmentStore(prisma),
    provider: buildKiriminAjaAdapter(),
  });
}
