import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms/AuthCard";
import { PasswordlessLogin } from "@/components/forms/PasswordlessLogin";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { requestAdminCode, verifyAdminCode } from "./actions";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin">) {
  const admin = await getCurrentAdmin().catch(() => null);
  if (admin) redirect("/admin/dashboard");
  const params = await searchParams;

  return (
    <AuthCard title="Admin sign in" description="Authorised Loan Central staff only. We'll email you a one-time code.">
      <PasswordlessLogin
        audience="admin"
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        requestCode={requestAdminCode}
        verifyCode={verifyAdminCode}
        notice={params.expired ? "Your session has expired. Please sign in again." : undefined}
      />
    </AuthCard>
  );
}
