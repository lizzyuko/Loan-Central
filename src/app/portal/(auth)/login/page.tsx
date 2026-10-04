import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms/AuthCard";
import { PasswordlessLogin } from "@/components/forms/PasswordlessLogin";
import { getCurrentApplicant } from "@/lib/auth/applicant";
import { requestApplicantCode, verifyApplicantCode } from "../actions";

export const metadata: Metadata = { title: "Track your application" };

export default async function PortalLoginPage({ searchParams }: PageProps<"/portal/login">) {
  const applicant = await getCurrentApplicant().catch(() => null);
  if (applicant) redirect("/portal");
  const params = await searchParams;

  return (
    <AuthCard
      title="Track your application"
      description="Enter the email you applied with. We'll send you a one-time code. No password needed."
      footer={
        <>
          Haven&apos;t applied yet? <Link href="/apply">Start an application</Link>
        </>
      }
    >
      <PasswordlessLogin
        audience="applicant"
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        requestCode={requestApplicantCode}
        verifyCode={verifyApplicantCode}
        notice={params.expired ? "Your session has expired. Please sign in again." : undefined}
      />
    </AuthCard>
  );
}
