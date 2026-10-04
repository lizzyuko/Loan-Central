"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { AuthError, requireAdmin } from "@/lib/auth/admin";
import type { Permission } from "@/lib/auth/permissions";
import { approveLoan, markDisbursed, recordPayment, voidPayment, type LoanResult } from "@/lib/loans/service";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import { approveLoanSchema, disburseSchema, recordPaymentSchema, voidPaymentSchema } from "@/lib/validation/loans";

async function run<S extends z.ZodType>(
  permission: Permission,
  schema: S,
  raw: unknown,
  fn: (admin: Awaited<ReturnType<typeof requireAdmin>>, input: z.output<S>) => Promise<LoanResult>,
): Promise<LoanResult> {
  try {
    const admin = await requireAdmin(permission);
    const limited = await rateLimit("adminSensitiveByAdmin", admin.id);
    if (!limited.success) return { ok: false, error: "Too many requests. Please wait a moment." };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const result = await fn(admin, parsed.data);
    if (result.ok) {
      revalidatePath("/admin/applications/[id]", "page");
      revalidatePath("/admin/loans");
    }
    return result;
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    logger.error("Loan action failed", { err });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function approveLoanAction(raw: unknown) {
  return run("loans.manage", approveLoanSchema, raw, (a, i) => approveLoan(a, i));
}

export async function disburseLoanAction(raw: unknown) {
  return run("loans.manage", disburseSchema, raw, (a, i) => markDisbursed(a, i.loanId, i.disbursedOn));
}

export async function recordPaymentAction(raw: unknown) {
  return run("loans.manage", recordPaymentSchema, raw, (a, i) => recordPayment(a, i));
}

export async function voidPaymentAction(raw: unknown) {
  return run("payments.void", voidPaymentSchema, raw, (a, i) => voidPayment(a, i.paymentId, i.reason));
}
