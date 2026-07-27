import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/request-security";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await deleteSession();
    return NextResponse.json(
      { signedOut: true },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "The session could not be signed out." },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
        status: 403,
      },
    );
  }
}
