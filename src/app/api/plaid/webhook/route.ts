import { after, NextResponse } from "next/server";
import {
  parsePlaidTransactionsWebhook,
  processPlaidTransactionsWebhook,
  verifyPlaidWebhook,
} from "@/lib/plaid/webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verification = request.headers.get("plaid-verification");
  if (!verification)
    return NextResponse.json({ accepted: false }, { status: 401 });
  try {
    await verifyPlaidWebhook(rawBody, verification);
    const webhook = parsePlaidTransactionsWebhook(JSON.parse(rawBody));
    after(async () => {
      try {
        await processPlaidTransactionsWebhook(webhook);
      } catch {
        // Connection state records the safe provider error for owner review.
      }
    });
    return NextResponse.json({ accepted: true }, { status: 202 });
  } catch {
    return NextResponse.json({ accepted: false }, { status: 401 });
  }
}
