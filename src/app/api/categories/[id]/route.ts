/**
 * GET    /api/categories/[id] — public, fetch one (excludes soft-deleted).
 * PATCH  /api/categories/[id] — admin only, partial update.
 * DELETE /api/categories/[id] — admin only, soft delete.
 *
 * MAS-31.
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

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const { id } = await ctx.params;
  try {
    const cat = await getService().getCategoryById(id);
    if (!cat || cat.deletedAt) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "category not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, category: categoryToJson(cat) });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

interface PatchBody {
  name?: unknown;
  slug?: unknown;
  parentId?: unknown;
}

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
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

  const { id } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    const j = badJsonBody();
    return NextResponse.json(j.body, { status: j.status });
  }

  const patch: { name?: string; slug?: string; parentId?: string | null } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`name` must be string" },
        { status: 400 },
      );
    }
    patch.name = body.name;
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
  if (body.parentId !== undefined) {
    if (body.parentId === null) patch.parentId = null;
    else if (typeof body.parentId === "string") patch.parentId = body.parentId;
    else {
      return NextResponse.json(
        { ok: false, code: "BAD_BODY", message: "`parentId` must be string or null" },
        { status: 400 },
      );
    }
  }

  try {
    const cat = await getService().updateCategory(id, patch);
    return NextResponse.json({ ok: true, category: categoryToJson(cat) });
  } catch (err) {
    if (!(err instanceof CategoryError) && !(err instanceof AuthError)) {
      console.error("[categories:PATCH] unexpected error", err);
    }
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
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
  const { id } = await ctx.params;
  try {
    const cat = await getService().softDeleteCategory(id);
    return NextResponse.json({ ok: true, category: categoryToJson(cat) });
  } catch (err) {
    if (!(err instanceof CategoryError) && !(err instanceof AuthError)) {
      console.error("[categories:DELETE] unexpected error", err);
    }
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
