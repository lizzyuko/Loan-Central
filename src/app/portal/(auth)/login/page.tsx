import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms/AuthCard";
import { LoginForm } from "@/components/forms/PasswordAuthForms";
import { getCurrentApplicant } from "@/lib/auth/applicant";
import { safeRedirectPath } from "@/lib/security/request";
import { loginApplicant } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function PortalLoginPage({ searchParams }: PageProps<"/portal/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : null, "/portal");
  const applicant = await getCurrentApplicant().catch(() => null);
  if (applicant) redirect(next);

  return (
    <AuthCard
      title="Track your application"
      description="Sign in with the email and password you created when you applied."
      footer={
        <>
          Haven&apos;t applied yet? <Link href="/apply">Start an application</Link>
        </>
      }
    >
      <LoginForm
        basePath="/portal"
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        login={loginApplicant}
        next={next}
        notice={params.expired ? "Your session has expired. Please sign in again." : undefined}
      />
    </AuthCard>
  );
}
