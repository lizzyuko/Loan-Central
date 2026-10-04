import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/forms/AuthCard";
import { MagicLinkConfirm } from "@/components/forms/MagicLinkConfirm";
import { verifyApplicantLink } from "../actions";

export const metadata: Metadata = { title: "Confirm sign in", referrer: "no-referrer" };

export default async function PortalVerifyPage({ searchParams }: PageProps<"/portal/verify">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  return (
    <AuthCard title="Confirm sign in" description="Continue to open your Loan Central applicant portal.">
      {value ? (
        <MagicLinkConfirm token={value} verify={verifyApplicantLink} retryHref="/portal/login" />
      ) : (
        <p>
          This link is incomplete. <Link href="/portal/login">Request a new code</Link>.
        </p>
      )}
    </AuthCard>
  );
}
