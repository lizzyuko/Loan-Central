"use server";

import { redirect } from "next/navigation";
import { getCurrentApplicant } from "@/lib/auth/applicant";
import { handleChangePassword, handleForgotPassword, handleLogin, handleLogout, handleSetPassword } from "@/lib/auth/login-actions";

export async function loginApplicant(raw: unknown) {
  return handleLogin("applicant", raw);
}

export async function forgotApplicantPassword(raw: unknown) {
  return handleForgotPassword("applicant", raw);
}

export async function resetApplicantPassword(raw: unknown) {
  return handleSetPassword("applicant", "PASSWORD_RESET", raw);
}

export async function changeApplicantPassword(raw: unknown) {
  const applicant = await getCurrentApplicant().catch(() => null);
  if (!applicant) return { ok: false as const, error: "Your session has expired. Please sign in again." };
  return handleChangePassword("applicant", applicant.id, raw);
}

export async function logoutApplicant() {
  await handleLogout("applicant");
  redirect("/portal/login");
}
