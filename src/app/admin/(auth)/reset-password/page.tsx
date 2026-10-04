import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/forms/AuthCard";
import { SetPasswordForm } from "@/components/forms/AdminAuthForms";
import { Alert } from "@/components/ui/Feedback";
import { inspectAdminToken } from "@/lib/auth/admin-tokens";
import { resetPassword } from "../actions";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/admin/reset-password">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const target = value ? await inspectAdminToken("PASSWORD_RESET", value) : null;

  return (
    <AuthCard title="Choose a new password" description={target ? `For ${target.email}` : undefined}>
      {target ? (
        <SetPasswordForm token={value} email={target.email} submit={resetPassword} submitLabel="Save password and sign in" />
      ) : (
        <>
          <Alert tone="danger" title="This link is invalid or has expired">
            Reset links work once and expire after 30 minutes.
          </Alert>
          <Link href="/admin/forgot-password">Request a new link</Link>
        </>
      )}
    </AuthCard>
  );
}
