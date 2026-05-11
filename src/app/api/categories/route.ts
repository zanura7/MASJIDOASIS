/**
 * GET  /api/categories — public, list categories (excludes soft-deleted).
 * POST /api/categories — admin only, create category.
 *
 * MAS-31.
 *
 * Query params on GET:
 *   - parentId=<id|null>   optional filter (string "null" → root only)
 *   - tree=true            return nested tree shape instead of flat
 *
 * Body on POST:
 *   { name: string, slug?: string, parentId?: string|null }
 */

import { NextRequest, NextResponse } from "next/server";

import { requireRole, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import { CategoryService, CategoryError } from "@/server/marketplace/category-service";
import {
  badJsonBody,
  categoryToJson,
  marketplaceErrorToJson,
} from "@/server/marketplace/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getService(): CategoryService {
  return new CategoryService({ db: prisma });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const parentIdParam = url.searchParams.get("parentId");

  try {
    const svc = getService();
    let rows = await svc.listCategories();
    if (parentIdParam !== null) {
      const wanted = parentIdParam === "null" ? null : parentIdParam;
      rows = rows.filter((c) => c.parentId === wanted);
    }
    return NextResponse.json({
      ok: true,
      categories: rows.map(categoryToJson),
    });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

interface CreateBody {
  name?: unknown;
  slug?: unknown;
  parentId?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
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

  if (typeof body.name !== "string") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`name` is required (string)" },
      { status: 400 },
    );
  }
  const slugIn = body.slug === undefined ? undefined : body.slug;
  if (slugIn !== undefined && typeof slugIn !== "string") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`slug` must be string if provided" },
      { status: 400 },
    );
  }
  let parentId: string | null | undefined;
  if (body.parentId !== undefined) {
    if (body.parentId === null) parentId = null;
    else if (typeof body.parentId === "string") parentId = body.parentId;
    else {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`parentId` must be string or null" },
        { status: 400 },
      );
    }
  }

  try {
    const svc = getService();
    const cat = await svc.createCategory({
      name: body.name,
      slug: slugIn,
      parentId,
    });
    return NextResponse.json({ ok: true, category: categoryToJson(cat) }, { status: 201 });
  } catch (err) {
    if (!(err instanceof CategoryError) && !(err instanceof AuthError)) {
      console.error("[categories:POST] unexpected error", err);
    }
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
