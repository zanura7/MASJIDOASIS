/**
 * POST /api/donations
 *
 * Create a donation for a campaign and return the Midtrans Snap payment
 * token. Body shape:
 *   {
 *     campaignSlug: string,
 *     amountCents: string | number,    // serialise BigInt as string
 *     isAnonymous?: boolean,
 *     donorName?: string,              // overrides user name; required if anonymous-but-show-name use case
 *     message?: string,
 *   }
 *
 * Auth: required (member). Token claims provide donorId.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/server/auth/middleware";
import { makeDonationService } from "@/server/crowdfunding/factory";
import { DonationServiceError } from "@/server/crowdfunding/donation-service";
import { MidtransSnapError } from "@/server/payments/midtrans/snap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeDonation(d: Record<string, unknown>): Record<string, unknown> {
  return {
    ...d,
    amountCents: d.amountCents !== undefined ? String(d.amountCents) : d.amountCents,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: { sub: string };
  try {
    user = requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (!body.campaignSlug || body.amountCents === undefined) {
    return NextResponse.json(
      { error: "campaignSlug and amountCents are required" },
      { status: 400 },
    );
  }

  let amountCents: bigint;
  try {
    amountCents = BigInt(body.amountCents);
  } catch {
    return NextResponse.json(
      { error: "amountCents must be numeric string or integer" },
      { status: 400 },
    );
  }

  try {
    const svc = makeDonationService();
    const result = await svc.createDonation({
      campaignSlug: String(body.campaignSlug),
      donorId: user.sub,
      donorName: body.donorName ? String(body.donorName) : undefined,
      isAnonymous: Boolean(body.isAnonymous),
      amountCents,
      message: body.message ? String(body.message) : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        donation: serializeDonation(result.donation),
        token: result.token,
        redirectUrl: result.redirectUrl,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof DonationServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus },
      );
    }
    if (err instanceof MidtransSnapError) {
      return NextResponse.json(
        { error: err.message, code: "MIDTRANS_ERROR" },
        { status: 502 },
      );
    }
    if (err instanceof Error && /MIDTRANS|not configured/i.test(err.message)) {
      return NextResponse.json(
        { error: err.message, code: "MIDTRANS_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    console.error("POST /api/donations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
