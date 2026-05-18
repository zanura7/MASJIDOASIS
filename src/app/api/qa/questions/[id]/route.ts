/**
 * GET /api/qa/questions/[id] - question detail with answers
 *   - Public if status is OPEN/ANSWERED/CLOSED and not private
 *   - Private questions visible only to asker
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/middleware";
import { buildQuestionService } from "@/server/qa/factory";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  let userId: string | null = null;

    // Try to parse auth header (optional)
    try {
      const claims = requireAuth(req);
      if (claims) userId = claims.sub;
    } catch {
    // ignore — endpoint allows anonymous
  }

  try {
    const svc = buildQuestionService();
    const question = await svc.getQuestionDetail(id);
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Privacy check
    if (question.isPrivate && question.askerId !== userId) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // PENDING/REJECTED only visible to asker
    if (
      (question.status === "PENDING" || question.status === "REJECTED") &&
      question.askerId !== userId
    ) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, question });
  } catch (err) {
    console.error("GET /api/qa/questions/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
