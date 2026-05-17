/**
 * POST /api/wallet/withdrawals
 *
 * Seller requests a withdrawal from their USER_BALANCE.
 *
 * Requires auth (SELLER role).
 */

import { NextRequest, NextResponse } from "next/server";

import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildWithdrawalService } from "@/server/wallet/withdrawal-factory";
import { WithdrawalError } from "@/server/wallet/withdrawal-service";

interface RequestBody {
  amountCents: string | number; // JSON doesn't support bigint
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  notes?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let claims;
  try {
    claims = requireRole(req, ["SELLER"]);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    !body.amountCents ||
    !body.bankName ||
    !body.bankAccountNo ||
    !body.bankAccountName
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  let amountCents: bigint;
  try {
    amountCents = BigInt(body.amountCents);
  } catch {
    return NextResponse.json(
      { error: "Invalid amountCents format" },
      { status: 400 },
    );
  }

  try {
    const svc = buildWithdrawalService();
    const w = await svc.requestWithdrawal({
      userId: claims.sub,
      amountCents,
      bankName: body.bankName.trim(),
      bankAccountNo: body.bankAccountNo.trim(),
      bankAccountName: body.bankAccountName.trim(),
      notes: body.notes?.trim(),
    });

    return NextResponse.json({
      ok: true,
      withdrawal: {
        ...w,
        amountCents: w.amountCents.toString(),
      },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof WithdrawalError) {
      const status =
        err.code === "INSUFFICIENT_BALANCE" || err.code === "AMOUNT_NOT_POSITIVE"
          ? 400
          : 422;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    console.error("POST /api/wallet/withdrawals error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let claims;
  try {
    claims = requireRole(req, ["SELLER"]);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

  try {
    const svc = buildWithdrawalService();
    const rows = await svc.listUserWithdrawals({ userId: claims.sub, limit });

    return NextResponse.json({
      ok: true,
      withdrawals: rows.map((w) => ({
        ...w,
        amountCents: w.amountCents.toString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/wallet/withdrawals error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
