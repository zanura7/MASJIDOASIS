import { LedgerService } from "./ledger-service";
import type { LedgerStore } from "./ledger-service";

export interface EscrowServiceDeps {
  ledger: LedgerService;
}

export class EscrowError extends Error {
  readonly code: "ORDER_NOT_COMPLETED" | "ESCROW_ALREADY_RELEASED";
  readonly httpStatus: number;
  constructor(code: EscrowError["code"], httpStatus: number, message: string) {
    super(message);
    this.name = "EscrowError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class EscrowService {
  private readonly ledger: LedgerService;
  constructor(deps: EscrowServiceDeps) {
    this.ledger = deps.ledger;
  }

  async releaseOrderEscrow(input: {
    order: {
      id: string;
      buyerId: string;
      sellerId: string;
      status: string;
      totalCents: number;
      currency: string;
    };
    now?: Date;
  }) {
    if (input.order.status !== "COMPLETED") {
      throw new EscrowError(
        "ORDER_NOT_COMPLETED",
        409,
        `Cannot release escrow for order ${input.order.id} because status is ${input.order.status}`
      );
    }

    const now = input.now ?? new Date();

    const buyerEscrow = await this.ledger.ensureAccount({
      userId: input.order.buyerId,
      type: "USER_ESCROW",
      currency: input.order.currency,
    });

    const sellerBalance = await this.ledger.ensureAccount({
      userId: input.order.sellerId,
      type: "USER_BALANCE",
      currency: input.order.currency,
    });

    await this.ledger.transfer({
      fromAccountId: buyerEscrow.id,
      toAccountId: sellerBalance.id,
      amountCents: BigInt(input.order.totalCents),
      reason: "ORDER_RELEASE",
      orderId: input.order.id,
      idempotencyKey: `order:${input.order.id}:escrow-release`,
      meta: { source: "order_completed" },
      now,
    });
  }
}
