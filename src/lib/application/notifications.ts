import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { countryName } from "@/config/countries";
import { formatMoney } from "@/config/currencies";
import { appUrl } from "@/lib/env";
import { recordEventSafe, SYSTEM_ACTOR } from "@/lib/audit";
import { sendAndRecord } from "@/lib/email/communications";
import { adminNewApplicationEmail, applicationConfirmationEmail } from "@/lib/email/templates";
import { logger } from "@/lib/security/logger";
import type { SubmittedApplication } from "./submit";

export const portalUrl = () => `${appUrl()}/portal`;
export const adminApplicationUrl = (id: string) => `${appUrl()}/admin/applications/${id}`;

/** Applicant confirmation + admin notifications after a successful submission. */
export async function notifyApplicationSubmitted(app: SubmittedApplication): Promise<void> {
  const confirmation = await sendAndRecord({
    applicationId: app.id,
    type: "APPLICATION_CONFIRMATION",
    to: app.email,
    email: applicationConfirmationEmail({ firstName: app.firstName, reference: app.reference, portalUrl: portalUrl() }),
    portalBody: "We've received your application. A member of our team will review it soon.",
    visibleToApplicant: true,
  });
  await recordEventSafe({
    applicationId: app.id,
    type: "email.confirmation",
    summary: confirmation.status === "SENT" ? "Confirmation email sent" : "Confirmation email could not be sent",
    actor: SYSTEM_ACTOR,
    metadata: { deliveryStatus: confirmation.status },
  });

  try {
    // Only admins who have accepted their invitation (set a password) receive alerts.
    const recipients = await getDb()
      .select({ email: admins.email })
      .from(admins)
      .where(and(eq(admins.isActive, true), isNotNull(admins.passwordHash)));
    const email = adminNewApplicationEmail({
      reference: app.reference,
      amount: formatMoney(app.amount, app.currency),
      productName: app.productName ?? "Not specified",
      country: countryName(app.country),
      adminUrl: adminApplicationUrl(app.id),
    });
    await Promise.all(
      recipients.map((r) =>
        sendAndRecord({ applicationId: app.id, type: "ADMIN_NOTIFICATION", to: r.email, email, visibleToApplicant: false }),
      ),
    );
  } catch (err) {
    logger.error("Admin notification failed", { err });
  }
}
