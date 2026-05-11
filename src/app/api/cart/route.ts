/**
 * GET    /api/cart        — fetch (or lazily create) the authenticated user's cart.
 * POST   /api/cart/items  — add a product (or increment qty).
 * DELETE /api/cart        — clear all items.
 *
 * MAS-33.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import { CartService } from "@/server/marketplace/cart-service";
import { buildCartStore } from "@/server/marketplace/prisma-stores";
import {
  badJsonBody,
  cartToJson,
  marketplaceErrorToJson,
} from "@/server/marketplace/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getService(): CartService {
  return new CartService({ db: buildCartStore(prisma) });
}

function authOrFail(req: NextRequest): { sub: string } | NextResponse {
  try {
    const claims = requireAuth(req);
    return { sub: claims.sub };
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const cart = await getService().getCart(auth.sub);
    return NextResponse.json({ ok: true, cart: cartToJson(cart) });
  } catch (err) {
    console.error("[cart:GET]", err);
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

interface AddBody {
  productId?: unknown;
  quantity?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;

  let body: AddBody;
  try {
    body = (await req.json()) as AddBody;
  } catch {
    const j = badJsonBody();
    return NextResponse.json(j.body, { status: j.status });
  }

  if (typeof body.productId !== "string") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`productId` must be string" },
      { status: 400 },
    );
  }

  try {
    const cart = await getService().addItem(auth.sub, body.productId, body.quantity);
    return NextResponse.json({ ok: true, cart: cartToJson(cart) }, { status: 201 });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const cart = await getService().clearCart(auth.sub);
    return NextResponse.json({ ok: true, cart: cartToJson(cart) });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
