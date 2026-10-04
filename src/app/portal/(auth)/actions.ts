"use server";

import { redirect } from "next/navigation";
import { handleLogout, handleRequestCode, handleVerifyCode, handleVerifyLink } from "@/lib/auth/login-actions";

export async function requestApplicantCode(input: unknown) {
  return handleRequestCode("applicant", input);
}

export async function verifyApplicantCode(input: unknown) {
  return handleVerifyCode("applicant", input);
}

export async function verifyApplicantLink(input: unknown) {
  return handleVerifyLink("applicant", input);
}

export async function logoutApplicant() {
  await handleLogout("applicant");
  redirect("/portal/login");
}
