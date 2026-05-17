import { prisma } from "@/server/db";
import { buildLedgerStoreFromPrisma } from "@/server/marketplace/prisma-stores";
import { LedgerService } from "./ledger-service";
import { buildWithdrawalStore } from "./prisma-store";
import { WithdrawalService } from "./withdrawal-service";

export function buildWithdrawalService(): WithdrawalService {
  const ledger = new LedgerService({ store: buildLedgerStoreFromPrisma(prisma) });
  return new WithdrawalService({
    store: buildWithdrawalStore(prisma),
    ledger,
  });
}
