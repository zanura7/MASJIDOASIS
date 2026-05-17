/**
 * POST /api/admin/comments/[id]/moderate
 * Body: { status: "APPROVED" | "REJECTED" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildCommentService } from "@/server/dakwah/factory";
import { CommentServiceError, type CommentStatus } from "@/server/dakwah/comment-service";

export async function POST(
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

  const status = body.status as CommentStatus;
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const svc = buildCommentService();
    const comment = await svc.moderateComment((await params).id, status);
    return NextResponse.json({ ok: true, comment });
  } catch (err) {
    if (err instanceof CommentServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
