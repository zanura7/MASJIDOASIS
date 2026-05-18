/**
 * POST /api/admin/qa/questions/[id]/moderate
 * Body: { status: "OPEN" | "REJECTED" | "CLOSED" }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildQuestionService } from "@/server/qa/factory";
import { QuestionServiceError, type QuestionStatus } from "@/server/qa/question-service";

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

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const status = body.status as QuestionStatus;
  if (!["OPEN", "REJECTED", "CLOSED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const svc = buildQuestionService();
    const question = await svc.moderateQuestion(id, status);
    return NextResponse.json({ ok: true, question });
  } catch (err) {
    if (err instanceof QuestionServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
