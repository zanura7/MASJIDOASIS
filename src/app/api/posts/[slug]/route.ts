/**
 * GET /api/posts/[slug] - get single post with comments
 */

import { NextRequest, NextResponse } from "next/server";
import { buildPostService, buildCommentService } from "@/server/dakwah/factory";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const commentLimit = Math.min(parseInt(searchParams.get("commentLimit") || "50", 10), 100);
  const commentOffset = Math.max(parseInt(searchParams.get("commentOffset") || "0", 10), 0);

  try {
    const postSvc = buildPostService();
    const post = await postSvc.getPostBySlug((await params).slug);

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const commentSvc = buildCommentService();
    const comments = await commentSvc.listPostComments(post.id, {
      limit: commentLimit,
      offset: commentOffset,
    });

    return NextResponse.json({ ok: true, post, comments });
  } catch (err) {
    console.error("GET /api/posts/[slug] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
