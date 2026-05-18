/**
 * GET    /api/campaigns/[idOrSlug]  — public campaign detail by slug (or id)
 * PATCH  /api/campaigns/[idOrSlug]  — admin update by id
 * DELETE /api/campaigns/[idOrSlug]  — admin delete by id
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/server/auth/middleware";
import { makeCampaignService } from "@/server/crowdfunding/factory";
import { CampaignServiceError } from "@/server/crowdfunding/campaign-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeCampaign(c: Record<string, unknown>): Record<string, unknown> {
  return {
    ...c,
    targetCents: c.targetCents !== undefined ? String(c.targetCents) : c.targetCents,
    raisedCents: c.raisedCents !== undefined ? String(c.raisedCents) : c.raisedCents,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ idOrSlug: string }> },
): Promise<NextResponse> {
  try {
    const { idOrSlug } = await params;
    const svc = makeCampaignService();
    // Try find by slug first, then fallback to findById if standard demands it.
    let campaign = await svc.getCampaignBySlug(idOrSlug);
    if (!campaign) {
      campaign = await svc.getCampaignById(idOrSlug);
    }

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status === "DRAFT") {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, campaign: serializeCampaign(campaign) });
  } catch (err) {
    console.error("GET /api/campaigns/[idOrSlug] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ idOrSlug: string }> },
): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
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

  const update: any = {};
  if (typeof body.title === "string") update.title = body.title;
  if (typeof body.description === "string") update.description = body.description;
  if (body.targetCents !== undefined) {
    try {
      update.targetCents = BigInt(body.targetCents);
    } catch {
      return NextResponse.json({ error: "Invalid targetCents" }, { status: 400 });
    }
  }
  if (body.coverImage !== undefined) update.coverImage = body.coverImage;
  if (body.startsAt !== undefined) update.startsAt = body.startsAt ? new Date(body.startsAt) : undefined;
  if (body.endsAt !== undefined) update.endsAt = body.endsAt ? new Date(body.endsAt) : undefined;

  try {
    const { idOrSlug } = await params;
    const svc = makeCampaignService();
    const campaign = await svc.updateCampaign(idOrSlug, update);
    return NextResponse.json({ ok: true, campaign: serializeCampaign(campaign) });
  } catch (err) {
    if (err instanceof CampaignServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus },
      );
    }
    console.error("PATCH /api/campaigns/[idOrSlug] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ idOrSlug: string }> },
): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { idOrSlug } = await params;
    const svc = makeCampaignService();
    await svc.deleteCampaign(idOrSlug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CampaignServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus },
      );
    }
    console.error("DELETE /api/campaigns/[idOrSlug] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
