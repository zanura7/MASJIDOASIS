/**
 * POST /api/posts/[slug]/comments - add comment
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/server/auth/middleware";
import { buildPostService, buildCommentService } from "@/server/dakwah/factory";
import { CommentServiceError } from "@/server/dakwah/comment-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  let user: { sub: string };
  try {
    user = requireAuth(req);
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
    const postSvc = buildPostService();
    const post = await postSvc.getPostBySlug((await params).slug);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const commentSvc = buildCommentService();
    const comment = await commentSvc.addComment({
      postId: post.id,
      authorId: user.sub,
      body: body.body,
      parentId: body.parentId,
    });

    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (err) {
    if (err instanceof CommentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error("POST /api/posts/[slug]/comments error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
