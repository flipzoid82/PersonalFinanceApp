import { NextResponse } from "next/server";
import { getSessionStatus } from "@/lib/auth";

export async function GET() {
  const status = await getSessionStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store, max-age=0" },
    status: status.status === "active" ? 200 : 401,
  });
}
