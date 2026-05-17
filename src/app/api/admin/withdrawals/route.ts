/**
 * GET /api/admin/withdrawals
 *
 * Admin views all withdrawals. Can filter by status.
 *
 * Requires ADMIN role.
 */

import { NextRequest, NextResponse } from "next/server";
import type { WithdrawalStatus } from "@prisma/client";

import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildWithdrawalService } from "@/server/wallet/withdrawal-factory";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);
  const statusParam = searchParams.get("status");

  let status: WithdrawalStatus | undefined;
  if (statusParam) {
    // Basic validation
    const valid = ["REQUESTED", "APPROVED", "REJECTED", "PAID", "CANCELLED"];
    if (!valid.includes(statusParam)) {
      return NextResponse.json({ error: "Invalid status parameter" }, { status: 400 });
    }
    status = statusParam as WithdrawalStatus;
  }

  try {
    const svc = buildWithdrawalService();
    const rows = await svc.listAll({
      status,
      limit,
      offset,
    });

    return NextResponse.json({
      ok: true,
      withdrawals: rows.map((w) => ({
        ...w,
        amountCents: w.amountCents.toString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/withdrawals error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
