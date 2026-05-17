/**
 * POST /api/admin/withdrawals/[id]/reject
 *
 * Admin rejects a REQUESTED withdrawal. Status-only change, no ledger
 * movement (funds stay in seller's USER_BALANCE).
 *
 * Requires ADMIN role.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildWithdrawalService } from "@/server/wallet/withdrawal-factory";
import { WithdrawalError } from "@/server/wallet/withdrawal-service";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

interface RejectBody {
  reason: string;
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  let claims;
  try {
    claims = requireRole(req, ["ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: withdrawalId } = await ctx.params;

  let body: RejectBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.reason || !body.reason.trim()) {
    return NextResponse.json({ error: "Reason required" }, { status: 400 });
  }

  try {
    const svc = buildWithdrawalService();
    const w = await svc.rejectWithdrawal({
      withdrawalId,
      adminId: claims.sub,
      reason: body.reason.trim(),
    });

    return NextResponse.json({
      ok: true,
      withdrawal: {
        ...w,
        amountCents: w.amountCents.toString(),
      },
    });
  } catch (err) {
    if (err instanceof WithdrawalError) {
      const status =
        err.code === "WITHDRAWAL_NOT_FOUND"
          ? 404
          : err.code === "INVALID_STATUS"
            ? 409
            : 422;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    console.error("POST /api/admin/withdrawals/[id]/reject error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
