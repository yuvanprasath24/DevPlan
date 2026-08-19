import { NextResponse } from "next/server";
import {
  planRequestSchema,
  type ApiQuestionsResponse,
} from "../../../lib/types";
import { generateQuestions } from "../../../lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request
): Promise<NextResponse<ApiQuestionsResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body. Expected JSON." },
      { status: 400 }
    );
  }

  const parsed = planRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (parsed.data.mode === "hackathon" && !parsed.data.timeLimitHours) {
    return NextResponse.json(
      { ok: false, error: "Provide a time limit for hackathon mode." },
      { status: 400 }
    );
  }

  try {
    const data = await generateQuestions(parsed.data);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Question generation failed.";
    console.error("[devplan] question generation failed:", err);
    const status = message.startsWith("Missing GEMINI_API_KEY") ? 500 : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}