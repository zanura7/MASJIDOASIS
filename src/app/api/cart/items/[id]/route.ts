/**
 * PATCH  /api/cart/items/[id]  — update quantity.
 * DELETE /api/cart/items/[id]  — remove item.
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

interface RouteCtx {
  params: Promise<{ id: string }>;
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

interface PatchBody {
  quantity?: unknown;
}

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    const j = badJsonBody();
    return NextResponse.json(j.body, { status: j.status });
  }

  try {
    const cart = await getService().updateItem(auth.sub, id, body.quantity);
    return NextResponse.json({ ok: true, cart: cartToJson(cart) });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  try {
    const cart = await getService().removeItem(auth.sub, id);
    return NextResponse.json({ ok: true, cart: cartToJson(cart) });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
