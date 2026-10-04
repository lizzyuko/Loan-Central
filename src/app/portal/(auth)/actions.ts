"use server";

import { redirect } from "next/navigation";
import { handleLogout, handleRequestCode, handleVerifyCode, handleVerifyLink } from "@/lib/auth/login-actions";

export async function requestApplicantCode(input: unknown) {
  return handleRequestCode(input);
}

export async function verifyApplicantCode(input: unknown) {
  return handleVerifyCode(input);
}

export async function verifyApplicantLink(input: unknown) {
  return handleVerifyLink(input);
}

export async function logoutApplicant() {
  await handleLogout("applicant");
  redirect("/portal/login");
}
