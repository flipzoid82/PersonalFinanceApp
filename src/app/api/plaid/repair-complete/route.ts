import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { repairPlaidConnection } from "@/lib/plaid";
import { plaidApiError, requireSameOrigin } from "../request";

const inputSchema = z.object({
  connectionId: z.string().min(1).max(255),
});

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = await requireUser();
    await repairPlaidConnection(
      owner.id,
      inputSchema.parse(await request.json()).connectionId,
    );
    return NextResponse.json({ repaired: true });
  } catch (error) {
    return plaidApiError(error);
  }
}
