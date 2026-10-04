import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/client";
import { adminInviteEmail } from "@/lib/email/templates";
import { tokenLink } from "./password-auth";
import { issueToken, TOKEN_TTL_MS } from "./tokens";

/** Admin invitations. Admin accounts are never self-registered. */
export async function sendInvite(adminId: string, invitedBy: { id: string; name: string }) {
  const [target] = await getDb().select({ email: admins.email, name: admins.name }).from(admins).where(eq(admins.id, adminId));
  if (!target) throw new Error("Admin not found");
  const token = await issueToken("admin", adminId, "INVITE", invitedBy.id);
  const result = await sendEmail(
    target.email,
    adminInviteEmail({ name: target.name, inviterName: invitedBy.name, link: tokenLink("admin", "INVITE", token), days: TOKEN_TTL_MS.INVITE / 86_400_000 }),
  );
  await recordAudit({ actor: { type: "ADMIN", adminId: invitedBy.id }, action: "admin.invited", targetType: "admin", targetId: adminId, metadata: { deliveryStatus: result.status } });
  return result.status;
}
