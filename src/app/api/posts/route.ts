/**
 * GET /api/posts - public feed of published posts
 */

import { NextRequest, NextResponse } from "next/server";
import { buildPostService } from "@/server/dakwah/factory";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  try {
    const svc = buildPostService();
    const posts = await svc.getFeed({ limit, offset });
    return NextResponse.json({ ok: true, posts });
  } catch (err) {
    console.error("GET /api/posts error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
