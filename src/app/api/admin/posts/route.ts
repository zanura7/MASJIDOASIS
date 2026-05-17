/**
 * GET /api/admin/posts
 * POST /api/admin/posts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildPostService } from "@/server/dakwah/factory";
import { PostServiceError } from "@/server/dakwah/post-service";
import type { PostKind } from "@/server/dakwah/post-service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const svc = buildPostService();
  const rows = await svc.listAllAdmin({ limit, offset });

  return NextResponse.json({ ok: true, posts: rows });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: { sub: string };
  try {
    user = requireRole(req, ["ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  try {
    const svc = buildPostService();
    const post = await svc.createPost({
      authorId: user.sub,
      kind: (body.kind as PostKind) || "ARTICLE",
      title: body.title,
      body: body.body || "",
      videoUrl: body.videoUrl,
      coverImage: body.coverImage,
    });
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (err) {
    if (err instanceof PostServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
