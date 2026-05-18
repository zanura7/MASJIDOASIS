/**
 * GET /api/donations/[campaignId]
 *
 * Public list of PAID donations for a campaign. Donor name is hidden
 * (replaced with "Hamba Allah") when isAnonymous=true.
 */

import { NextRequest, NextResponse } from "next/server";
import { makeDonationService } from "@/server/crowdfunding/factory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PublicDonation {
  id: string;
  donorName: string;
  amountCents: string;
  currency: string;
  message: string | null;
  paidAt: Date | null | undefined;
}

function toPublic(d: Record<string, unknown>): PublicDonation {
  const isAnon = Boolean(d.isAnonymous);
  const snapshot =
    typeof d.donorNameSnapshot === "string" && d.donorNameSnapshot.length > 0
      ? d.donorNameSnapshot
      : "Hamba Allah";
  return {
    id: String(d.id),
    donorName: isAnon ? "Hamba Allah" : snapshot,
    amountCents: String(d.amountCents),
    currency: String(d.currency ?? "IDR"),
    message: (d.message as string | null) ?? null,
    paidAt: d.paidAt as Date | null | undefined,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
): Promise<NextResponse> {
  try {
    const { campaignId } = await params;
    const svc = makeDonationService();
    const rows = await svc.listDonationsByCampaign(campaignId);
    return NextResponse.json({
      ok: true,
      donations: rows.map(toPublic),
    });
  } catch (err) {
    console.error("GET /api/donations/[campaignId] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
