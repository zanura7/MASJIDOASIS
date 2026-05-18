/**
 * GET  /api/campaigns        — public list of ACTIVE campaigns
 * POST /api/campaigns        — admin create (DRAFT)
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

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const svc = makeCampaignService();
    const rows = await svc.listActiveCampaigns();
    return NextResponse.json({
      ok: true,
      campaigns: rows.map(serializeCampaign),
    });
  } catch (err) {
    console.error("GET /api/campaigns error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: { sub: string };
  try {
    user = requireRole(req, ["ADMIN"]);
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

  if (!body.title || !body.description || body.targetCents === undefined) {
    return NextResponse.json(
      { error: "title, description, and targetCents are required" },
      { status: 400 },
    );
  }

  let targetCents: bigint;
  try {
    targetCents = BigInt(body.targetCents);
  } catch {
    return NextResponse.json(
      { error: "targetCents must be a numeric string or integer" },
      { status: 400 },
    );
  }

  try {
    const svc = makeCampaignService();
    const campaign = await svc.createCampaign({
      ownerId: user.sub,
      title: String(body.title),
      description: String(body.description),
      targetCents,
      coverImage: body.coverImage,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
    });
    return NextResponse.json(
      { ok: true, campaign: serializeCampaign(campaign) },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof CampaignServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus },
      );
    }
    console.error("POST /api/campaigns error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
