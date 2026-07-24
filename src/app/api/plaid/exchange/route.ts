import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { exchangePlaidPublicToken } from "@/lib/plaid";
import { plaidApiError, requireSameOrigin } from "../request";

const inputSchema = z.object({
  publicToken: z.string().min(1).max(1000),
  linkSessionId: z.string().min(1).max(255),
  institutionId: z.string().max(255).nullable().optional(),
  institutionName: z.string().max(255).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = await requireUser();
    const result = await exchangePlaidPublicToken(
      owner.id,
      inputSchema.parse(await request.json()),
    );
    return NextResponse.json({
      connected: true,
      duplicate: result.duplicate,
    });
  } catch (error) {
    return plaidApiError(error);
  }
}
