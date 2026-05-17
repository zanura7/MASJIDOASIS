/**
 * PUT /api/admin/posts/[id] - update post
 * DELETE /api/admin/posts/[id] - delete post
 * PATCH /api/admin/posts/[id] - change status (publish/unpublish/archive)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildPostService } from "@/server/dakwah/factory";
import { PostServiceError, type PostStatus } from "@/server/dakwah/post-service";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
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
    const post = await svc.updatePost((await params).id, {
      title: body.title,
      body: body.body,
      videoUrl: body.videoUrl,
      coverImage: body.coverImage,
    });
    return NextResponse.json({ ok: true, post });
  } catch (err) {
    if (err instanceof PostServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const svc = buildPostService();
    await svc.deletePost((await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PostServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireRole(req, ["ADMIN"]);
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

  const status = body.status as PostStatus;
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const svc = buildPostService();
    const post = await svc.setPublishStatus((await params).id, status);
    return NextResponse.json({ ok: true, post });
  } catch (err) {
    if (err instanceof PostServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
