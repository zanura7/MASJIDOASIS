/**
 * POST /api/qa/questions  - member submits new question (PENDING moderation)
 * GET /api/qa/questions  - public feed (OPEN/ANSWERED/CLOSED, non-private)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/server/auth/middleware";
import { buildQuestionService } from "@/server/qa/factory";
import { QuestionServiceError, type QuestionCategory } from "@/server/qa/question-service";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as QuestionCategory | null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  if (category && !["USTADZ", "DOKTER"].includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    const svc = buildQuestionService();
    const questions = await svc.listPublicQuestions({
      category: category ?? undefined,
      limit,
      offset,
    });
    return NextResponse.json({ ok: true, questions });
  } catch (err) {
    console.error("GET /api/qa/questions error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: { sub: string };
  try {
    user = requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const category = body.category as QuestionCategory;
  if (!["USTADZ", "DOKTER"].includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  try {
    const svc = buildQuestionService();
    const question = await svc.askQuestion({
      askerId: user.sub,
      category,
      title: body.title,
      body: body.body,
      isPrivate: !!body.isPrivate,
    });
    return NextResponse.json({ ok: true, question }, { status: 201 });
  } catch (err) {
    if (err instanceof QuestionServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    console.error("POST /api/qa/questions error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
