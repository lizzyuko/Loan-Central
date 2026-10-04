import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/forms/AuthCard";
import { MagicLinkConfirm } from "@/components/forms/MagicLinkConfirm";
import { verifyAdminLink } from "../actions";

export const metadata: Metadata = { title: "Confirm sign in", referrer: "no-referrer" };

export default async function AdminVerifyPage({ searchParams }: PageProps<"/admin/verify">) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";

  return (
    <AuthCard title="Confirm sign in" description="Continue to finish signing in to the Loan Central admin dashboard.">
      {value ? (
        <MagicLinkConfirm token={value} verify={verifyAdminLink} retryHref="/admin" />
      ) : (
        <p>
          This link is incomplete. <Link href="/admin">Request a new code</Link>.
        </p>
      )}
    </AuthCard>
  );
}
