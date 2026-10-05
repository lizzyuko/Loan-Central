/**
 * End-to-end server flows against a real Postgres database.
 * Run with:  TEST_DATABASE_URL=postgres://... npm test
 * Use a disposable database (e.g. a Neon branch): tables are truncated.
 */
import "../support/next-mocks";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { cookieJar, flushAfter, snapshotCookies, asBrowser } from "../support/next-mocks";
import { validSubmission } from "../unit/validation.test";

const RUN = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!RUN)("integration", async () => {
  // Collection still runs for skipped suites; don't touch the DB without a URL.
  if (!RUN) {
    it("requires TEST_DATABASE_URL", () => undefined);
    return;
  }
  const { getDb } = await import("@/db");
  const schema = await import("@/db/schema");
  const { __setTransport } = await import("@/lib/email/client");
  const { submitApplication } = await import("@/lib/application/submit");
  const passwordAuth = await import("@/lib/auth/password-auth");
  const { MAX_FAILED_LOGINS } = passwordAuth;
  const { sendInvite } = await import("@/lib/auth/admin-auth");
  const { getCurrentApplicant } = await import("@/lib/auth/applicant");
  type Kind = "admin" | "applicant";
  // Admin is the default kind; applicant tests pass it explicitly.
  const loginWithPassword = (o: Parameters<typeof passwordAuth.loginWithPassword>[1], kind: Kind = "admin") => passwordAuth.loginWithPassword(kind, o);
  const requestPasswordReset = (o: Parameters<typeof passwordAuth.requestPasswordReset>[1], kind: Kind = "admin") => passwordAuth.requestPasswordReset(kind, o);
  const redeemToken = (o: Parameters<typeof passwordAuth.redeemToken>[1], kind: Kind = "admin") => passwordAuth.redeemToken(kind, o);
  const { hashPassword } = await import("@/lib/auth/password");
  const { getCurrentAdmin, requireAdmin, AuthError } = await import("@/lib/auth/admin");
  const { getOwnedApplicationId } = await import("@/lib/auth/applicant");
  const { getPortalApplication, submitAccountDetails, PortalError } = await import("@/lib/portal/service");
  const review = await import("@/lib/admin/review");
  const { GET: documentRoute } = await import("@/app/api/documents/[id]/route");
  const { revealAccountAction, changeStatusAction } = await import("@/app/admin/(console)/applications/[id]/actions");
  const { accountDetailsSchema } = await import("@/lib/validation/account");

  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const ctx = { ip: "203.0.113.7", ipHash: "iphash", userAgent: "vitest" };
  const db = getDb();

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    __setTransport(async ({ to, email }) => {
      sent.push({ to, subject: email.subject, text: email.text });
      return { status: "SENT", providerMessageId: "test" };
    });
  });

  afterAll(() => __setTransport(null));

  beforeEach(async () => {
    sent.length = 0;
    asBrowser();
    await db.execute(sql`TRUNCATE admins, applicants, applications, loan_products, document_types, audit_logs, communications, rate_limits CASCADE`);
    await db.insert(schema.documentTypes).values([
      { key: "government_id_front", label: "ID front", description: "ID" },
      { key: "government_id_back", label: "ID back", description: "ID" },
      { key: "proof_of_income", label: "Income", description: "Income" },
    ]);
  });

  /** Inserts draft documents bound to the given draft hash, as the upload flow would. */
  async function draftDocs(draftHash: string) {
    const rows = await db
      .insert(schema.documents)
      .values(
        ["government_id_front", "government_id_back", "proof_of_income"].map((t, i) => ({
          draftTokenHash: draftHash,
          documentType: t,
          originalFilename: `${t}.pdf`,
          mimeType: "application/pdf",
          bytes: 1000,
          cloudinaryPublicId: `test/${draftHash}/${i}-${Math.random()}`,
          cloudinaryResourceType: "image",
          cloudinaryVersion: 1,
        })),
      )
      .returning({ id: schema.documents.id });
    return rows.map((r) => r.id);
  }

  async function submit(overrides: Record<string, unknown> = {}, draftHash = "draft-hash-1") {
    const ids = await draftDocs(draftHash);
    return submitApplication({ ...validSubmission, idempotencyKey: crypto.randomUUID(), documents: { documentIds: ids }, ...overrides }, { ctx, draftTokenHash: draftHash });
  }

  const PASSWORD = "river-lantern-copper-71";

  async function makeAdmin(role: "ADMIN" | "SUPER_ADMIN", email = `${role.toLowerCase()}@test.dev`, withPassword = true) {
    const [a] = await db
      .insert(schema.admins)
      .values({ email, name: role, role, passwordHash: withPassword ? await hashPassword(PASSWORD) : null })
      .returning();
    return a!;
  }

  async function signInAdmin(adminId: string) {
    asBrowser();
    const [a] = await db.select().from(schema.admins).where(eq(schema.admins.id, adminId));
    const res = await loginWithPassword({ email: a!.email, password: PASSWORD, turnstileToken: "ok", ctx });
    expect(res.ok).toBe(true);
    return snapshotCookies();
  }

  /** Pull the token out of the most recent emailed link. */
  function tokenFromLastEmail(): string {
    const match = sent.at(-1)?.text.match(/token=([A-Za-z0-9_%-]+)/);
    if (!match?.[1]) throw new Error("No token link in last email");
    return decodeURIComponent(match[1]);
  }

  // --- Submission ----------------------------------------------------------------

  it("submits an application, attaches documents and records consent + events", async () => {
    const out = await submit();
    expect(out.result.ok).toBe(true);
    const app = out.created!;
    expect(app.reference).toMatch(/^LC-\d{4}-\d{6}$/);

    const docs = await db.select().from(schema.documents).where(eq(schema.documents.applicationId, app.id));
    expect(docs).toHaveLength(3);
    expect(docs.every((d) => d.status === "ATTACHED" && d.draftTokenHash === null)).toBe(true);
    expect(await db.select().from(schema.consents).where(eq(schema.consents.applicationId, app.id))).toHaveLength(4);
    expect(await db.select().from(schema.applicationEvents).where(eq(schema.applicationEvents.applicationId, app.id))).toHaveLength(1);
  });

  it("is idempotent for retried submissions", async () => {
    const ids = await draftDocs("d2");
    const payload = { ...validSubmission, idempotencyKey: crypto.randomUUID(), documents: { documentIds: ids } };
    const first = await submitApplication(payload, { ctx, draftTokenHash: "d2" });
    const second = await submitApplication(payload, { ctx, draftTokenHash: "d2" });
    expect(first.result.ok && second.result.ok).toBe(true);
    if (first.result.ok && second.result.ok) expect(second.result.reference).toBe(first.result.reference);
    expect(await db.select().from(schema.applications)).toHaveLength(1);
  });

  it("blocks accidental duplicates from a second tab", async () => {
    expect((await submit({}, "tab-1")).result.ok).toBe(true);
    const dup = await submit({}, "tab-2");
    expect(dup.result.ok).toBe(false);
  });

  it("rejects failed bot checks and documents from another browser", async () => {
    expect((await submit({ turnstileToken: "bad-token" })).result.ok).toBe(false);
    const ids = await draftDocs("someone-else");
    const stolen = await submitApplication({ ...validSubmission, idempotencyKey: crypto.randomUUID(), documents: { documentIds: ids } }, { ctx, draftTokenHash: "mine" });
    expect(stolen.result.ok).toBe(false);
  });

  it("requires the configured documents", async () => {
    const r = await submitApplication({ ...validSubmission, idempotencyKey: crypto.randomUUID() }, { ctx, draftTokenHash: "x" });
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.step).toBe("documents");
  });

  // --- Admin authentication -----------------------------------------------------------

  it("signs admins in with a password and rejects wrong or unknown credentials generically", async () => {
    await makeAdmin("ADMIN", "staff@test.dev");
    const wrong = await loginWithPassword({ email: "staff@test.dev", password: "not-the-password-1", turnstileToken: "ok", ctx });
    const unknown = await loginWithPassword({ email: "stranger@test.dev", password: PASSWORD, turnstileToken: "ok", ctx });
    expect(wrong).toEqual(unknown); // same message: no account enumeration
    expect((await loginWithPassword({ email: "staff@test.dev", password: PASSWORD, turnstileToken: "bad-token", ctx })).ok).toBe(false);
    expect((await loginWithPassword({ email: "staff@test.dev", password: PASSWORD, turnstileToken: "ok", ctx })).ok).toBe(true);
  });

  it("locks the account after repeated failures", async () => {
    await makeAdmin("ADMIN", "lock@test.dev");
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await loginWithPassword({ email: "lock@test.dev", password: "wrong-password-xx", turnstileToken: "ok", ctx });
    }
    const res = await loginWithPassword({ email: "lock@test.dev", password: PASSWORD, turnstileToken: "ok", ctx });
    expect(res.ok).toBe(false);
    const [row] = await db.select().from(schema.admins).where(eq(schema.admins.email, "lock@test.dev"));
    expect(row!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("invites an admin who sets their own password; invite links are single use", async () => {
    const inviter = await makeAdmin("SUPER_ADMIN");
    const invitee = await makeAdmin("ADMIN", "new@test.dev", false);
    await sendInvite(invitee.id, { id: inviter.id, name: "Inviter" });
    const token = tokenFromLastEmail();
    expect(sent.at(-1)?.to).toBe("new@test.dev");

    // Cannot sign in before accepting.
    expect((await loginWithPassword({ email: "new@test.dev", password: PASSWORD, turnstileToken: "ok", ctx })).ok).toBe(false);

    asBrowser();
    expect((await redeemToken({ purpose: "INVITE", token, password: PASSWORD, ctx })).ok).toBe(true);
    expect((await getCurrentAdmin())?.id).toBe(invitee.id);
    expect((await redeemToken({ purpose: "INVITE", token, password: PASSWORD, ctx })).ok).toBe(false);
    // An invite token is not usable as a reset token.
    expect((await redeemToken({ purpose: "PASSWORD_RESET", token, password: PASSWORD, ctx })).ok).toBe(false);
  });

  it("resets a password by email, revoking existing sessions; unknown emails get no email", async () => {
    const admin = await makeAdmin("ADMIN", "reset@test.dev");
    const oldSession = await signInAdmin(admin.id);

    expect(await requestPasswordReset({ email: "nobody@test.dev", turnstileToken: "ok", ctx })).toEqual({ ok: true });
    expect(await requestPasswordReset({ email: "reset@test.dev", turnstileToken: "ok", ctx })).toEqual({ ok: true });
    await flushAfter();
    expect(sent.map((m) => m.to)).toEqual(["reset@test.dev"]);
    const token = tokenFromLastEmail();

    // Expired tokens fail.
    await db.update(schema.adminTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await redeemToken({ purpose: "PASSWORD_RESET", token, password: "a-brand-new-password-9", ctx })).ok).toBe(false);

    await requestPasswordReset({ email: "reset@test.dev", turnstileToken: "ok", ctx });
    await flushAfter();
    const fresh = tokenFromLastEmail();
    asBrowser();
    expect((await redeemToken({ purpose: "PASSWORD_RESET", token: fresh, password: "a-brand-new-password-9", ctx })).ok).toBe(true);

    asBrowser(oldSession);
    expect(await getCurrentAdmin()).toBeNull(); // old session revoked
    expect((await loginWithPassword({ email: "reset@test.dev", password: PASSWORD, turnstileToken: "ok", ctx })).ok).toBe(false);
    expect((await loginWithPassword({ email: "reset@test.dev", password: "a-brand-new-password-9", turnstileToken: "ok", ctx })).ok).toBe(true);
  });

  it("creates the applicant's account on submission and lets them sign in with it", async () => {
    const app = (await submit()).created!;
    const [row] = await db.select().from(schema.applicants).where(eq(schema.applicants.id, app.applicantId));
    expect(row!.passwordHash).toMatch(/^scrypt\$/);
    expect(row!.passwordHash).not.toContain(validSubmission.password);

    asBrowser();
    const res = await loginWithPassword({ email: app.email, password: validSubmission.password, turnstileToken: "ok", ctx }, "applicant");
    expect(res.ok).toBe(true);
    expect((await getCurrentApplicant())?.id).toBe(app.applicantId);
  });

  it("rejects weak passwords for new accounts", async () => {
    const r = await submit({ password: "short" });
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.step).toBe("review");
  });

  it("requires the existing password to add an application to an existing account", async () => {
    const first = (await submit({}, "first")).created!;
    // Get past the accidental-duplicate window.
    await db.update(schema.applications).set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) });

    const hijack = await submit({ password: "attacker-password-123", personal: { ...validSubmission.personal, firstName: "Mallory" } }, "second");
    expect(hijack.result.ok).toBe(false);
    const [unchanged] = await db.select().from(schema.applicants).where(eq(schema.applicants.id, first.applicantId));
    expect(unchanged!.firstName).toBe(validSubmission.personal.firstName);

    const legit = await submit({}, "third");
    expect(legit.result.ok).toBe(true);
    expect(legit.created!.applicantId).toBe(first.applicantId);
  });

  it("asks legacy accounts without a password to reset first", async () => {
    const first = (await submit({}, "legacy-1")).created!;
    await db.update(schema.applicants).set({ passwordHash: null }).where(eq(schema.applicants.id, first.applicantId));
    await db.update(schema.applications).set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) });
    const r = await submit({}, "legacy-2");
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.error).toMatch(/Forgot password/);
  });

  it("resets an applicant password by email", async () => {
    const app = (await submit()).created!;
    sent.length = 0;
    expect(await requestPasswordReset({ email: app.email, turnstileToken: "ok", ctx }, "applicant")).toEqual({ ok: true });
    expect(await requestPasswordReset({ email: "stranger@test.dev", turnstileToken: "ok", ctx }, "applicant")).toEqual({ ok: true });
    await flushAfter();
    expect(sent.map((m) => m.to)).toEqual([app.email]);
    const token = tokenFromLastEmail();
    // Applicant tokens can't be redeemed as admin tokens.
    expect((await redeemToken({ purpose: "PASSWORD_RESET", token, password: "a-brand-new-password-9", ctx }, "admin")).ok).toBe(false);
    asBrowser();
    expect((await redeemToken({ purpose: "PASSWORD_RESET", token, password: "a-brand-new-password-9", ctx }, "applicant")).ok).toBe(true);
    expect((await getCurrentApplicant())?.id).toBe(app.applicantId);
    expect((await loginWithPassword({ email: app.email, password: "a-brand-new-password-9", turnstileToken: "ok", ctx }, "applicant")).ok).toBe(true);
  });

  it("creates a session only after verification and blocks deactivated admins", async () => {
    const admin = await makeAdmin("ADMIN");
    asBrowser();
    expect(await getCurrentAdmin()).toBeNull();
    await expect(requireAdmin()).rejects.toBeInstanceOf(AuthError);

    const cookies = await signInAdmin(admin.id);
    asBrowser(cookies);
    expect((await getCurrentAdmin())?.id).toBe(admin.id);

    await db.update(schema.admins).set({ isActive: false }).where(eq(schema.admins.id, admin.id));
    asBrowser(cookies);
    expect(await getCurrentAdmin()).toBeNull();
  });

  it("rejects forged session cookies", async () => {
    asBrowser({ lc_admin_session: "x".repeat(43) });
    expect(await getCurrentAdmin()).toBeNull();
  });

  // --- Authorization -----------------------------------------------------------------

  it("prevents applicants from accessing another applicant's application", async () => {
    const mine = (await submit({}, "a")).created!;
    const theirs = (
      await submit({ personal: { ...validSubmission.personal, email: "other@example.com" } }, "b")
    ).created!;
    const [me] = await db.select().from(schema.applicants).where(eq(schema.applicants.email, mine.email));
    expect(await getOwnedApplicationId(me!.id, mine.id)).toBe(mine.id);
    expect(await getOwnedApplicationId(me!.id, theirs.id)).toBeNull();
    expect(await getPortalApplication(me!.id, theirs.id)).toBeNull();
  });

  it("protects private documents from unauthenticated users", async () => {
    const app = (await submit()).created!;
    const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.applicationId, app.id));
    asBrowser();
    const res = await documentRoute(new Request("http://localhost/api/documents/x"), { params: Promise.resolve({ id: doc!.id }) });
    expect(res.status).toBe(401);
  });

  it("only lets authorised admins change status, and enforces transitions", async () => {
    const app = (await submit()).created!;
    asBrowser();
    expect((await changeStatusAction({ applicationId: app.id, status: "UNDER_REVIEW", notify: false })).ok).toBe(false);

    const admin = await makeAdmin("ADMIN");
    asBrowser(await signInAdmin(admin.id));
    expect((await changeStatusAction({ applicationId: app.id, status: "UNDER_REVIEW", notify: false })).ok).toBe(true);
    // Invalid jump
    expect((await changeStatusAction({ applicationId: app.id, status: "COMPLETED", notify: false })).ok).toBe(false);
  });

  it("restricts account details to the right applicant, status and permission", async () => {
    const app = (await submit()).created!;
    const [applicant] = await db.select().from(schema.applicants).where(eq(schema.applicants.email, app.email));
    const current = { id: applicant!.id, email: applicant!.email, firstName: applicant!.firstName, sessionId: "s" };
    const parsed = accountDetailsSchema.parse({
      applicationId: app.id,
      accountHolderName: "Amara Okafor",
      bankName: "Example Bank",
      country: "DE",
      currency: "EUR",
      identifiers: { iban: "DE89370400440532013000" },
      confirm: true,
    });

    // Not yet requested
    await expect(submitAccountDetails(current, parsed, null)).rejects.toBeInstanceOf(PortalError);

    const reviewer = await makeAdmin("ADMIN");
    const reviewerSession = { id: reviewer.id, email: reviewer.email, name: reviewer.name, role: reviewer.role, sessionId: "s" };
    expect((await review.recordEligibility(reviewerSession, app.id, true, undefined, false)).ok).toBe(true);
    expect((await review.requestAccountDetails(reviewerSession, app.id, undefined)).ok).toBe(true);

    // Another applicant cannot submit for this application
    await expect(submitAccountDetails({ ...current, id: crypto.randomUUID() }, parsed, null)).rejects.toBeInstanceOf(PortalError);

    await submitAccountDetails(current, parsed, null);
    const [stored] = await db.select().from(schema.accountDetails).where(eq(schema.accountDetails.applicationId, app.id));
    expect(stored!.maskedIdentifier).toBe("••••3000");
    expect(stored!.encryptedPayload).not.toContain("DE89370400440532013000");

    // Normal admins cannot reveal; super admins can, and it's audited.
    asBrowser(await signInAdmin(reviewer.id));
    expect((await revealAccountAction({ applicationId: app.id })).ok).toBe(false);

    const superAdmin = await makeAdmin("SUPER_ADMIN");
    asBrowser(await signInAdmin(superAdmin.id));
    const revealed = await revealAccountAction({ applicationId: app.id });
    expect(revealed.ok && revealed.values.iban).toBe("DE89370400440532013000");
    const audits = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "account_details.revealed"));
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits[0]!.metadata ?? {})).not.toContain("DE89");

    // Emails never contain account data
    expect(sent.some((s) => s.text.includes("DE89"))).toBe(false);
    expect(cookieJar.size).toBeGreaterThan(0);
  });

  it("runs the loan lifecycle: approve, disburse, pay, remind, repay, void", async () => {
    const loans = await import("@/lib/loans/service");
    const { toIsoDate } = await import("@/lib/loans/schedule");
    const app = (await submit()).created!;
    await db.update(schema.applications).set({ status: "FINAL_REVIEW" }).where(eq(schema.applications.id, app.id));
    const reviewer = await makeAdmin("ADMIN");
    const admin = { id: reviewer.id, email: reviewer.email, name: reviewer.name, role: reviewer.role, sessionId: "s" };
    const today = toIsoDate(new Date());

    // Approval creates the loan and schedule: 1,200 at 10% flat for 12 months = 1,320 over 12 x 110.
    const approved = await loans.approveLoan(admin, {
      applicationId: app.id, principal: "1200", currency: "GBP", annualRatePct: 10, termMonths: 12, frequency: "MONTHLY", firstDueDate: today, message: undefined, notify: true,
    });
    expect(approved.ok).toBe(true);
    const detail = (await loans.getLoanByApplication(app.id))!;
    expect(detail.loan.totalRepayable).toBe("1320.00");
    expect(detail.installments).toHaveLength(12);
    expect(detail.installments[0]!.amountDue).toBe("110.00");
    const [appRow] = await db.select().from(schema.applications).where(eq(schema.applications.id, app.id));
    expect(appRow!.status).toBe("APPROVED");
    expect(sent.some((m) => m.subject.includes("approved"))).toBe(true);

    // Applicants only see their own loan.
    expect(await loans.getApplicantLoan(crypto.randomUUID(), app.id)).toBeNull();
    expect(await loans.getApplicantLoan(app.applicantId, app.id)).not.toBeNull();

    // No payments or reminders before disbursement.
    expect((await loans.recordPayment(admin, { loanId: detail.loan.id, amount: "10", paidOn: today, method: "cash", reference: undefined, note: undefined, notify: false })).ok).toBe(false);
    expect((await loans.runPaymentReminders(today)).sent).toBe(0);

    expect((await loans.markDisbursed(admin, detail.loan.id, today)).ok).toBe(true);

    // Due-today reminder goes out once.
    sent.length = 0;
    expect((await loans.runPaymentReminders(today)).sent).toBe(1);
    expect((await loans.runPaymentReminders(today)).sent).toBe(0);
    expect(sent).toHaveLength(1);

    // Partial payment, overpayment rejected, then full repayment completes the application.
    expect((await loans.recordPayment(admin, { loanId: detail.loan.id, amount: "150", paidOn: today, method: "bank_transfer", reference: undefined, note: undefined, notify: true })).ok).toBe(true);
    let d = (await loans.getLoanByApplication(app.id))!;
    expect(d.installments[0]!.status).toBe("PAID");
    expect(d.installments[1]!.status).toBe("PARTIAL");
    expect(d.summary.outstanding).toBe("1170.00");
    expect((await loans.recordPayment(admin, { loanId: detail.loan.id, amount: "5000", paidOn: today, method: "bank_transfer", reference: undefined, note: undefined, notify: false })).ok).toBe(false);

    expect((await loans.recordPayment(admin, { loanId: detail.loan.id, amount: "1170", paidOn: today, method: "bank_transfer", reference: undefined, note: undefined, notify: true })).ok).toBe(true);
    d = (await loans.getLoanByApplication(app.id))!;
    expect(d.loan.status).toBe("PAID_OFF");
    const [done] = await db.select().from(schema.applications).where(eq(schema.applications.id, app.id));
    expect(done!.status).toBe("COMPLETED");

    // Voiding a payment re-opens the loan.
    const last = d.payments.find((p) => p.amount === "1170.00")!;
    expect((await loans.voidPayment(admin, last.id, "Entered twice")).ok).toBe(true);
    d = (await loans.getLoanByApplication(app.id))!;
    expect(d.loan.status).toBe("ACTIVE");
    expect(d.summary.outstanding).toBe("1170.00");
    const [reopened] = await db.select().from(schema.applications).where(eq(schema.applications.id, app.id));
    expect(reopened!.status).toBe("APPROVED");
  });


  it("only notifies admins who have accepted their invitation", async () => {
    const { notifyApplicationSubmitted } = await import("@/lib/application/notifications");
    await makeAdmin("SUPER_ADMIN", "active@test.dev");
    await makeAdmin("ADMIN", "pending@test.dev", false);
    const app = (await submit()).created!;
    sent.length = 0;
    await notifyApplicationSubmitted(app);
    const recipients = sent.map((m) => m.to);
    expect(recipients).toContain("active@test.dev");
    expect(recipients).not.toContain("pending@test.dev");
  });

  it("deletes administrators but never yourself or the last super admin", async () => {
    const { deleteAdmin, SettingsError } = await import("@/lib/admin/settings");
    const owner = await makeAdmin("SUPER_ADMIN", "owner@test.dev");
    const staff = await makeAdmin("ADMIN", "staff@test.dev");
    const me = { id: owner.id, email: owner.email, name: owner.name, role: owner.role, sessionId: "s" };

    await expect(deleteAdmin(me, owner.id)).rejects.toBeInstanceOf(SettingsError);
    await deleteAdmin(me, staff.id);
    expect(await db.select().from(schema.admins).where(eq(schema.admins.id, staff.id))).toHaveLength(0);

    // A second super admin can't delete the only other active one.
    const other = await makeAdmin("SUPER_ADMIN", "other@test.dev");
    await db.update(schema.admins).set({ isActive: false }).where(eq(schema.admins.id, owner.id));
    const otherSelf = { id: other.id, email: other.email, name: other.name, role: other.role, sessionId: "s" };
    await db.update(schema.admins).set({ isActive: true }).where(eq(schema.admins.id, owner.id));
    await deleteAdmin(otherSelf, owner.id); // owner deletable while "other" remains
    const third = await makeAdmin("ADMIN", "third@test.dev");
    await db.update(schema.admins).set({ role: "SUPER_ADMIN" }).where(eq(schema.admins.id, third.id));
    const thirdSelf = { id: third.id, email: third.email, name: third.name, role: "SUPER_ADMIN" as const, sessionId: "s" };
    await deleteAdmin(thirdSelf, other.id);
    await expect(deleteAdmin(otherSelf, third.id)).rejects.toBeInstanceOf(SettingsError);
  });

  it("stores the national ID encrypted with a masked hint", async () => {
    const app = (await submit()).created!;
    const [row] = await db.select().from(schema.applications).where(eq(schema.applications.id, app.id));
    expect(row!.nationalIdType).toBe("NINO");
    expect(row!.nationalIdMasked).toBe("••••456C");
    expect(row!.nationalIdEncrypted).not.toContain("AB123456C");
  });

});
