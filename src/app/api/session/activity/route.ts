import { NextResponse } from "next/server";
import { getSessionStatus, recordSessionActivity } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const result = await recordSessionActivity();
    const status = await getSessionStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store, max-age=0" },
      status: result.status === "active" ? 200 : 401,
    });
  } catch {
    return NextResponse.json(
      { error: "The session activity could not be recorded." },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
        status: 403,
      },
    );
  }
}
