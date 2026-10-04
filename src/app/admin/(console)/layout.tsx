import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/auth/admin";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
