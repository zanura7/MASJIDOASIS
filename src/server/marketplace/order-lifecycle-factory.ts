import { prisma } from "@/server/db";
import { OrderLifecycleService } from "./order-lifecycle-service";
import { buildOrderLifecycleStore, buildLedgerStoreFromPrisma } from "./prisma-stores";
import { EscrowService } from "@/server/wallet/escrow-service";
import { LedgerService } from "@/server/wallet/ledger-service";

/**
 * Builds the OrderLifecycleService fully wired with its side-effects
 * (e.g. escrow release on COMPLETED).
 */
export function buildOrderLifecycleService(): OrderLifecycleService {
  return new OrderLifecycleService({
    db: buildOrderLifecycleStore(prisma),
    onOrderCompleted: async (order) => {
      // Lazy init to avoid cycle issues or early db connection if not needed
      const ledger = new LedgerService({ store: buildLedgerStoreFromPrisma(prisma) });
      const escrow = new EscrowService({ ledger });
      await escrow.releaseOrderEscrow({ order });
    },
  });
}
