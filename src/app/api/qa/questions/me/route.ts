/**
 * GET /api/qa/questions/me - list questions submitted by current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/server/auth/middleware";
import { buildQuestionService } from "@/server/qa/factory";

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: { sub: string };
  try {
    user = requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  try {
    const svc = buildQuestionService();
    const questions = await svc.listMyQuestions(user.sub, { limit, offset });
    return NextResponse.json({ ok: true, questions });
  } catch (err) {
    console.error("GET /api/qa/questions/me error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
