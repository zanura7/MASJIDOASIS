/**
 * POST /api/orders/auto-complete
 *
 * Sweep job: auto-complete every SHIPPED order whose `shippedAt` is older
 * than 7 days. Intended to be called by an internal cron / scheduled task.
 *
 * Auth: requires the `x-internal-token` header to match `INTERNAL_CRON_TOKEN`.
 * If the env var is unset we still require the header to be present and
 * non-empty so accidental public exposure 401s instead of 500-ing.
 *
 * Response: { ok: true, scanned: number, completed: string[] }
 *
 * MAS-34.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { type OrderLifecycleService } from "@/server/marketplace/order-lifecycle-service";
import { buildOrderLifecycleService } from "@/server/marketplace/order-lifecycle-factory";
import { marketplaceErrorToJson } from "@/server/marketplace/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getService(): OrderLifecycleService {
  return buildOrderLifecycleService();
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const provided = req.headers.get("x-internal-token") ?? "";
  const expected = process.env.INTERNAL_CRON_TOKEN ?? "";
  if (!provided || !expected || provided !== expected) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "internal token required" },
      { status: 401 },
    );
  }

  try {
    const result = await getService().autoCompleteShipped({ now: new Date() });
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      completed: result.completed,
    });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
