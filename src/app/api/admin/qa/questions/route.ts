/**
 * GET /api/admin/qa/questions - list PENDING questions for moderation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, AuthError } from "@/server/auth/middleware";
import { buildQuestionService } from "@/server/qa/factory";

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

  try {
    const svc = buildQuestionService();
    const questions = await svc.listForModeration({ limit, offset });
    return NextResponse.json({ ok: true, questions });
  } catch (err) {
    console.error("GET /api/admin/qa/questions error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
