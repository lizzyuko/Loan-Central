import type { Metadata } from "next";
import { AuthCard } from "@/components/forms/AuthCard";
import { SetPasswordForm } from "@/components/forms/PasswordAuthForms";
import { Alert } from "@/components/ui/Feedback";
import { inspectToken } from "@/lib/auth/tokens";
import { acceptInvite } from "../actions";

export const metadata: Metadata = { title: "Accept invitation", referrer: "no-referrer" };

export default async function AcceptInvitePage({ searchParams }: PageProps<"/admin/accept-invite">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const target = value ? await inspectToken("admin", "INVITE", value) : null;

  return (
    <AuthCard
      title={target ? `Welcome, ${target.name.split(" ")[0]}` : "Accept invitation"}
      description={target ? `Set a password for ${target.email} to activate your admin account.` : undefined}
    >
      {target ? (
        <SetPasswordForm token={value} email={target.email} submit={acceptInvite} submitLabel="Activate account" />
      ) : (
        <Alert tone="danger" title="This invitation is invalid or has expired">
          Invitations work once and expire after 7 days. Ask a super administrator to send you a new one.
        </Alert>
      )}
    </AuthCard>
  );
}
