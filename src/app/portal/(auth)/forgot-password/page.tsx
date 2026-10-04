import type { Metadata } from "next";
import { AuthCard } from "@/components/forms/AuthCard";
import { ForgotPasswordForm } from "@/components/forms/PasswordAuthForms";
import { forgotApplicantPassword } from "../actions";

export const metadata: Metadata = { title: "Reset password" };

export default function PortalForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email address you applied with. We'll send you a link to choose a new password."
    >
      <ForgotPasswordForm basePath="/portal" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} request={forgotApplicantPassword} />
    </AuthCard>
  );
}
