/**
 * POST /api/qa/questions/[id]/answers - Ustadz/Dokter answer OPEN question
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildAnswerService } from "@/server/qa/factory";
import { AnswerServiceError } from "@/server/qa/answer-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user: { sub: string };
  try {
    user = requireRole(req, ["USTADZ", "DOKTER"]);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  try {
    const svc = buildAnswerService();
    const answer = await svc.answerQuestion({
      questionId: id,
      responderId: user.sub,
      body: body.body,
    });
    return NextResponse.json({ ok: true, answer }, { status: 201 });
  } catch (err) {
    if (err instanceof AnswerServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error("POST /api/qa/questions/[id]/answers error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
