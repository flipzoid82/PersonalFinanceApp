import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { createPlaidLinkToken } from "@/lib/plaid";
import { plaidApiError, requireSameOrigin } from "../request";

const inputSchema = z.object({
  connectionId: z.string().min(1).max(255).optional(),
});

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = await requireApiUser({ activity: "meaningful" });
    const input = inputSchema.parse(await request.json());
    const linkToken = await createPlaidLinkToken(owner.id, input.connectionId);
    return NextResponse.json({ linkToken });
  } catch (error) {
    return plaidApiError(error);
  }
}
