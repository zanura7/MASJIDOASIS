/**
 * POST /api/admin/withdrawals/[id]/approve
 *
 * Admin approves a REQUESTED withdrawal. Triggers ledger transfer
 * USER_BALANCE → SYSTEM_PAYOUT and marks withdrawal APPROVED.
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

  try {
    const svc = buildWithdrawalService();
    const w = await svc.approveWithdrawal({
      withdrawalId,
      adminId: claims.sub,
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
    console.error("POST /api/admin/withdrawals/[id]/approve error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
