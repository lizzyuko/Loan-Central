import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { runPaymentReminders } from "@/lib/loans/service";
import { safeEqual } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";

/**
 * Daily repayment reminders (Vercel Cron, see vercel.json):
 * 3 days before, on the due date, and 1 and 7 days overdue. Each reminder is
 * sent at most once per instalment.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = cronSecret();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return jsonError(401, "Unauthorized");
  try {
    const result = await runPaymentReminders();
    logger.info("Payment reminders run", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("Payment reminders failed", { err });
    return jsonError(500, "Reminder run failed");
  }
}
