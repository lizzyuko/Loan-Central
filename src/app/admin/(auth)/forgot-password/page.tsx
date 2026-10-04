import type { Metadata } from "next";
import { AuthCard } from "@/components/forms/AuthCard";
import { ForgotPasswordForm } from "@/components/forms/AdminAuthForms";
import { forgotPassword } from "../actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" description="Enter the email you use to sign in. We'll send you a link to choose a new password.">
      <ForgotPasswordForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} request={forgotPassword} />
    </AuthCard>
  );
}
