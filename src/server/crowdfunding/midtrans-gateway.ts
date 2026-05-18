import type { PaymentGateway } from "./donation-service";
import {
  createSnapTransaction,
  MidtransSnapError,
} from "@/server/payments/midtrans/snap";
import { loadMidtransConfig } from "@/server/payments/midtrans/config";

export class MidtransPaymentGateway implements PaymentGateway {
  async createTransaction(input: {
    orderId: string;
    amountCents: bigint;
    customerDetails?: {
      firstName?: string;
      email?: string;
    };
  }): Promise<{ token: string; redirectUrl: string }> {
    const config = loadMidtransConfig();

    const amountCents = Number(input.amountCents);
    const grossAmount = Math.floor(amountCents / 100);

    const result = await createSnapTransaction(
      {
        orderId: input.orderId,
        amountCents,
        itemDetails: [
          {
            id: "donation",
            name: "Donasi",
            price: grossAmount,
            quantity: 1,
          },
        ],
        customerDetail: input.customerDetails
          ? {
              first_name: input.customerDetails.firstName || "Hamba Allah",
              email: input.customerDetails.email,
            }
          : undefined,
      },
      config,
    );

    return {
      token: result.token,
      redirectUrl: result.redirect_url,
    };
  }
}

export { MidtransSnapError };
