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
  const { requestLoginCode, verifyLoginCode } = await import("@/lib/auth/login");
  const { issueCode, verifyCode, MAX_ATTEMPTS } = await import("@/lib/auth/codes");
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
    await db.execute(sql`TRUNCATE admins, applicants, applications, loan_products, document_types, audit_logs, communications CASCADE`);
    await db.insert(schema.documentTypes).values([
      { key: "government_id", label: "ID", description: "ID" },
      { key: "proof_of_income", label: "Income", description: "Income" },
    ]);
  });

  /** Inserts draft documents bound to the given draft hash, as the upload flow would. */
  async function draftDocs(draftHash: string) {
    const rows = await db
      .insert(schema.documents)
      .values(
        ["government_id", "proof_of_income"].map((t, i) => ({
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

  async function makeAdmin(role: "ADMIN" | "SUPER_ADMIN", email = `${role.toLowerCase()}@test.dev`) {
    const [a] = await db.insert(schema.admins).values({ email, name: role, role }).returning();
    return a!;
  }

  async function signInAdmin(adminId: string) {
    asBrowser();
    const { code } = await issueCode("admin", adminId, { ipHash: null });
    const [a] = await db.select().from(schema.admins).where(eq(schema.admins.id, adminId));
    const res = await verifyLoginCode({ kind: "admin", email: a!.email, code, ctx });
    expect(res.ok).toBe(true);
    return snapshotCookies();
  }

  // --- Submission ----------------------------------------------------------------

  it("submits an application, attaches documents and records consent + events", async () => {
    const out = await submit();
    expect(out.result.ok).toBe(true);
    const app = out.created!;
    expect(app.reference).toMatch(/^LC-\d{4}-\d{6}$/);

    const docs = await db.select().from(schema.documents).where(eq(schema.documents.applicationId, app.id));
    expect(docs).toHaveLength(2);
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

  it("sends codes only to authorised admins, with generic responses", async () => {
    await makeAdmin("ADMIN", "staff@test.dev");
    expect(await requestLoginCode({ kind: "admin", email: "stranger@test.dev", turnstileToken: "ok", ctx })).toEqual({ ok: true });
    expect(await requestLoginCode({ kind: "admin", email: "staff@test.dev", turnstileToken: "ok", ctx })).toEqual({ ok: true });
    await flushAfter();
    expect(sent.map((s) => s.to)).toEqual(["staff@test.dev"]);
    expect(await db.select().from(schema.admins)).toHaveLength(1); // no account created for the stranger
  });

  it("enforces single use, expiry and attempt limits on codes", async () => {
    const admin = await makeAdmin("ADMIN");
    const { code } = await issueCode("admin", admin.id, { ipHash: null });
    expect((await verifyCode("admin", admin.id, code)).ok).toBe(true);
    expect((await verifyCode("admin", admin.id, code)).ok).toBe(false); // single use

    const second = await issueCode("admin", admin.id, { ipHash: null });
    await db.update(schema.adminVerificationCodes).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await verifyCode("admin", admin.id, second.code)).toEqual({ ok: false, reason: "expired" });

    const third = await issueCode("admin", admin.id, { ipHash: null });
    const wrong = third.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) expect((await verifyCode("admin", admin.id, wrong)).ok).toBe(false);
    expect(await verifyCode("admin", admin.id, wrong)).toEqual({ ok: false, reason: "too_many_attempts" });
    expect((await verifyCode("admin", admin.id, third.code)).ok).toBe(false); // burned
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
});
