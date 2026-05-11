/**
 * GET    /api/products/[id] — public for ACTIVE; owner/admin for others.
 * PATCH  /api/products/[id] — owner (SELLER) or ADMIN.
 * DELETE /api/products/[id] — owner (SELLER) or ADMIN. Soft delete.
 *
 * MAS-31.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import {
  ProductService,
  ProductError,
  type ProductStatus,
  type UpdateProductInput,
} from "@/server/marketplace/product-service";
import {
  badJsonBody,
  marketplaceErrorToJson,
  productToJson,
} from "@/server/marketplace/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getService(): ProductService {
  return new ProductService({ db: prisma });
}

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const p = await getService().getProductById(id);
    if (!p || p.deletedAt) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "product not found" },
        { status: 404 },
      );
    }
    if (p.status !== "ACTIVE") {
      // Non-active rows visible only to owner or admin.
      try {
        const claims = requireAuth(req);
        if (claims.role !== "ADMIN" && claims.sub !== p.sellerId) {
          return NextResponse.json(
            { ok: false, code: "NOT_FOUND", message: "product not found" },
            { status: 404 },
          );
        }
      } catch {
        return NextResponse.json(
          { ok: false, code: "NOT_FOUND", message: "product not found" },
          { status: 404 },
        );
      }
    }
    return NextResponse.json({ ok: true, product: productToJson(p) });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

interface PatchBody {
  title?: unknown;
  description?: unknown;
  slug?: unknown;
  priceCents?: unknown;
  currency?: unknown;
  stock?: unknown;
  weightGram?: unknown;
  images?: unknown;
  status?: unknown;
  categoryId?: unknown;
}

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  let claims;
  try {
    claims = requireRole(req, ["SELLER", "ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    throw err;
  }

  const { id } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    const j = badJsonBody();
    return NextResponse.json(j.body, { status: j.status });
  }

  const patch: UpdateProductInput = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`title` must be string" },
        { status: 400 },
      );
    }
    patch.title = body.title;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`description` must be string" },
        { status: 400 },
      );
    }
    patch.description = body.description;
  }
  if (body.slug !== undefined) {
    if (typeof body.slug !== "string") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`slug` must be string" },
        { status: 400 },
      );
    }
    patch.slug = body.slug;
  }
  if (body.priceCents !== undefined) {
    if (typeof body.priceCents !== "number") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`priceCents` must be number" },
        { status: 400 },
      );
    }
    patch.priceCents = body.priceCents;
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== "string") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`currency` must be string" },
        { status: 400 },
      );
    }
    patch.currency = body.currency;
  }
  if (body.stock !== undefined) {
    if (typeof body.stock !== "number") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`stock` must be number" },
        { status: 400 },
      );
    }
    patch.stock = body.stock;
  }
  if (body.weightGram !== undefined) {
    if (typeof body.weightGram !== "number") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`weightGram` must be number" },
        { status: 400 },
      );
    }
    patch.weightGram = body.weightGram;
  }
  if (body.images !== undefined) {
    if (!Array.isArray(body.images)) {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`images` must be array of strings" },
        { status: 400 },
      );
    }
    patch.images = body.images as string[];
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`status` must be string" },
        { status: 400 },
      );
    }
    patch.status = body.status as ProductStatus;
  }
  if (body.categoryId !== undefined) {
    if (body.categoryId === null) patch.categoryId = null;
    else if (typeof body.categoryId === "string") patch.categoryId = body.categoryId;
    else {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`categoryId` must be string or null" },
        { status: 400 },
      );
    }
  }

  try {
    const out = await getService().updateProduct(id, patch, {
      sellerId: claims.sub,
      role: claims.role === "ADMIN" ? "ADMIN" : "SELLER",
    });
    return NextResponse.json({ ok: true, product: productToJson(out) });
  } catch (err) {
    if (!(err instanceof ProductError) && !(err instanceof AuthError)) {
      console.error("[products:PATCH] unexpected error", err);
    }
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  let claims;
  try {
    claims = requireRole(req, ["SELLER", "ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
  const { id } = await ctx.params;
  try {
    const out = await getService().softDeleteProduct(id, {
      sellerId: claims.sub,
      role: claims.role === "ADMIN" ? "ADMIN" : "SELLER",
    });
    return NextResponse.json({ ok: true, product: productToJson(out) });
  } catch (err) {
    if (!(err instanceof ProductError) && !(err instanceof AuthError)) {
      console.error("[products:DELETE] unexpected error", err);
    }
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
