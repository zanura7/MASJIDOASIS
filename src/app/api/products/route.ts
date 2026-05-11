/**
 * GET  /api/products — public list with optional filters.
 *   Query: sellerId, categoryId, status, page, pageSize
 *   Public viewers can only see status=ACTIVE (or omit status).
 *   Authenticated sellers may pass `?mine=true` to view their own
 *   DRAFT/ARCHIVED items.
 *
 * POST /api/products — SELLER or ADMIN, create product.
 *   Body: { title, description, priceCents, slug?, currency?, stock?,
 *           weightGram?, images?, status?, categoryId? }
 *
 * MAS-31.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireRole, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import {
  ProductService,
  ProductError,
  type ListProductsFilter,
  type ProductStatus,
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

const STATUS_VALUES: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const sellerIdParam = url.searchParams.get("sellerId") ?? undefined;
  const categoryIdParam = url.searchParams.get("categoryId") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  const mineParam = url.searchParams.get("mine") === "true";

  let status: ProductStatus | undefined;
  if (statusParam) {
    if (!(STATUS_VALUES as string[]).includes(statusParam)) {
      return NextResponse.json(
        { ok: false, code: "BAD_QUERY", message: "status must be DRAFT|ACTIVE|ARCHIVED" },
        { status: 400 },
      );
    }
    status = statusParam as ProductStatus;
  }

  const page = pageParam ? Number(pageParam) : undefined;
  const pageSize = pageSizeParam ? Number(pageSizeParam) : undefined;
  if ((page !== undefined && !Number.isFinite(page)) || (pageSize !== undefined && !Number.isFinite(pageSize))) {
    return NextResponse.json(
      { ok: false, code: "BAD_QUERY", message: "page/pageSize must be numbers" },
      { status: 400 },
    );
  }

  let viewer: ListProductsFilter["viewer"] = { role: "PUBLIC" };
  let sellerId = sellerIdParam;
  if (mineParam) {
    try {
      const claims = requireAuth(req);
      viewer =
        claims.role === "ADMIN"
          ? { role: "ADMIN", sellerId: claims.sub }
          : { role: "OWNER", sellerId: claims.sub };
      sellerId = claims.sub;
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

  try {
    const rows = await getService().listProducts({
      sellerId,
      categoryId: categoryIdParam,
      status,
      viewer,
      page,
      pageSize,
    });
    return NextResponse.json({ ok: true, products: rows.map(productToJson) });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

interface CreateBody {
  title?: unknown;
  description?: unknown;
  priceCents?: unknown;
  slug?: unknown;
  currency?: unknown;
  stock?: unknown;
  weightGram?: unknown;
  images?: unknown;
  status?: unknown;
  categoryId?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    const j = badJsonBody();
    return NextResponse.json(j.body, { status: j.status });
  }

  if (typeof body.title !== "string") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`title` is required (string)" },
      { status: 400 },
    );
  }
  if (typeof body.description !== "string") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`description` is required (string)" },
      { status: 400 },
    );
  }
  if (typeof body.priceCents !== "number") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`priceCents` is required (number)" },
      { status: 400 },
    );
  }
  // The rest are passed through and validated by ProductService.

  try {
    const input = {
      title: body.title,
      description: body.description,
      priceCents: body.priceCents,
      ...(typeof body.slug === "string" ? { slug: body.slug } : {}),
      ...(typeof body.currency === "string" ? { currency: body.currency } : {}),
      ...(typeof body.stock === "number" ? { stock: body.stock } : {}),
      ...(typeof body.weightGram === "number" ? { weightGram: body.weightGram } : {}),
      ...(Array.isArray(body.images) ? { images: body.images as string[] } : {}),
      ...(typeof body.status === "string" ? { status: body.status as ProductStatus } : {}),
      ...(body.categoryId === null || typeof body.categoryId === "string"
        ? { categoryId: body.categoryId as string | null }
        : {}),
    };
    const product = await getService().createProduct(claims.sub, input);
    return NextResponse.json({ ok: true, product: productToJson(product) }, { status: 201 });
  } catch (err) {
    if (!(err instanceof ProductError) && !(err instanceof AuthError)) {
      console.error("[products:POST] unexpected error", err);
    }
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
