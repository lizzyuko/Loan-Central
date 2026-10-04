# Loan Central — Architecture

Priority order for every decision: **Security → Correctness → Maintainability → UX → Visual polish.**

## 1. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19.2, TypeScript strict | `proxy.ts` (not `middleware`), async `cookies()`/`params` |
| Styling | CSS Modules + global design tokens (`src/styles/tokens.css`) | No Tailwind |
| Forms | React Hook Form + Zod 4 | Same Zod schema runs client- and server-side |
| Database | Neon Postgres via `postgres` (postgres-js) + Drizzle ORM | Pooled connection string, `prepare: false` |
| Email | Resend | HTML templates built in `src/lib/email/templates` |
| Files | Cloudinary, `type: "authenticated"` (private) assets | Signed direct uploads, short-lived signed download URLs |
| Bot protection | Cloudflare Turnstile | Server-side `siteverify` on every protected action |
| Rate limiting | Postgres fixed-window counters (`rate_limits` table) | No extra service; fails closed |
| Phone numbers | `libphonenumber-js` | Stored in E.164 |
| Tests | Vitest | |

## 2. Authentication model

Two completely separate identity domains with separate tables, cookies and session lifetimes.

| | Admin | Applicant |
| --- | --- | --- |
| Identity | Row in `admins`: the first is seeded from `SEED_ADMIN_*`, the rest are invited by a super admin | Row in `applicants`, created on first submission |
| Login | `/admin` → email + password (scrypt). Invites and resets use emailed single-use links. | `/portal/login` → email → 6-digit code **or** magic link |
| Cookie | `lc_admin_session` | `lc_applicant_session` |
| Lifetime | 12 h absolute, 2 h idle | 2 h absolute, 30 min idle |

**Admin passwords:**

- Hashed with scrypt (N=2^15, r=8, p=1, random 16-byte salt). Parameters are stored in the hash string so they can be raised later.
- The policy is 12–128 characters, with obvious and repetitive passwords rejected (following NIST 800-63B).
- Login is rate-limited per email and per IP and protected by Turnstile. After 5 failures the account locks for 15 minutes.
- Unknown emails go through a dummy hash check, so response timing doesn't reveal which accounts exist.
- `admin_tokens` holds INVITE tokens (7 days) and PASSWORD_RESET tokens (30 minutes). They are 256-bit, stored as SHA-256, and single-use (an atomic conditional update).
- Redeeming a token sets the password, revokes every session, and signs the admin in. A reset also emails a "password changed" notice.

**Applicant verification codes** (`applicant_verification_codes`):

- 6-digit numeric code + separate 256-bit link token, generated with `crypto.randomInt` / `randomBytes`.
- Stored only as `HMAC-SHA256(SESSION_SECRET, purpose|email|value)`. Never stored or logged in plaintext.
- Expire after 10 minutes, single use (`consumed_at`), max 5 attempts, and issuing a new code invalidates the old ones.
- Requesting a code is rate limited per email and per IP, and needs Turnstile.
- Responses are always generic ("If that email is registered, we've sent a code") so emails can't be enumerated.
- The magic link opens a confirmation page that **POSTs** the token, so email link scanners can't burn it with a GET.

**Sessions** (`admin_sessions`, `applicant_sessions`): a random 256-bit token goes in an HTTP-only, `SameSite=Lax` cookie (`Secure` in production). Only its SHA-256 hash is stored. Sessions are revocable (logout sets `revoked_at`), and idle expiry is extended on use.

**Authorization layers:**

1. `proxy.ts` makes an optimistic redirect when the cookie is missing (UX only) and adds `X-Robots-Tag: noindex` to private routes.
2. The data access layer (`src/lib/auth/admin.ts`, `src/lib/auth/applicant.ts`) runs `requireAdmin()`, `requireRole()` and `requireApplicant()` against the DB on **every** protected page, server action and route handler.
3. Every applicant query is scoped by `applicant_id = session.applicantId`. IDs alone never grant access.

CSRF: server actions are POST-only with Next's built-in Origin/Host check, plus `SameSite=Lax` cookies. Route handlers that mutate state check `Origin` manually (`assertSameOrigin`).

## 3. Roles and permissions

`src/lib/auth/permissions.ts` maps each role to a set of permissions. Code checks **permissions, not roles**, so new roles can be added later.

- `ADMIN`: `applications.view`, `applications.review`, `notes.create`, `communications.send`, `documents.view`, `account_details.view_masked`
- `SUPER_ADMIN`: all of the above plus `account_details.reveal`, `admins.manage`, `products.manage`, `documents.configure`, `audit.view`, `settings.manage`

## 4. Application lifecycle

```
SUBMITTED → UNDER_REVIEW → MORE_INFORMATION_REQUIRED ⇄ UNDER_REVIEW
                        → ELIGIBLE → ACCOUNT_DETAILS_REQUESTED → FINAL_REVIEW → COMPLETED
                        → NOT_ELIGIBLE
```

The transition table lives in `src/lib/application/status.ts` and is enforced server-side, so the client never decides what's allowed. Every transition writes an `application_events` row and an `audit_logs` row. An applicant submitting requested info moves the application back to `UNDER_REVIEW`. Submitting account details moves it to `FINAL_REVIEW`.

Eligibility is **always a human decision**. `eligibility_rules` only produces advisory indicators (for example, DTI above the threshold) on the admin detail page.

## 5. Application submission flow

1. The wizard (`/apply`) holds state in React Hook Form and saves progress to `sessionStorage` on this device, so a refresh doesn't lose work. No server draft rows exist before submission (no spam surface).
2. **Document uploads before submission:** the browser asks `POST /api/uploads/sign` for a signature. The server:
   - checks the rate limit
   - issues an opaque `lc_upload_draft` HTTP-only cookie
   - signs an upload to a private Cloudinary folder with constraints on type, size and folder
   The browser uploads directly to Cloudinary, which avoids Vercel's 4.5 MB body limit. Then `POST /api/uploads/complete` verifies the asset through the Cloudinary Admin API (exists, folder, format, bytes) and stores a `documents` row bound to the draft token hash.
3. **Submit:** a server action re-validates everything with Zod, verifies Turnstile, checks the rate limit and the `idempotency_key` (unique), then in **one transaction** it:
   - upserts the applicant
   - inserts the application with a random `LC-YYYY-NNNNNN` reference
   - inserts the loan request, address, employment, financial profile and consents
   - attaches the draft documents
   - writes the event and audit rows
4. After the commit, emails go out (applicant confirmation and admin notification). Each send is recorded in `communications` with its delivery status. A failed email never rolls back the application.
5. A daily cron (`/api/cron/cleanup`, secured with `CRON_SECRET`) deletes orphaned draft uploads and expired codes and sessions, and purges account details past retention.

## 6. Sensitive data

- **Account details:** identifiers (account number, IBAN, routing, sort code, SWIFT and so on) are encrypted with AES-256-GCM (`ENCRYPTION_KEY`, 32 bytes) into one `encrypted_payload` column. Only the masked hint (`••••4821`), bank, holder, country and currency are stored in plaintext.
- Admin UI shows masked values. **Reveal** requires the `account_details.reveal` permission, is a POST action, and is audited (`account_details.revealed`).
- Account data never appears in emails, URLs or logs, and `purge_after` drives retention.
- **Documents:** private Cloudinary assets. `/api/documents/[id]` checks admin auth (or applicant ownership), writes an audit row, then redirects to a signed URL that expires in 5 minutes.
- **Logging:** `src/lib/security/logger.ts` redacts known sensitive keys. IP addresses are stored as salted hashes.

## 7. Database (Drizzle, `src/db/schema`)

Core: `admins`, `admin_sessions`, `admin_verification_codes`, `applicants`, `applicant_sessions`, `applicant_verification_codes`, `applications`, `loan_requests`, `addresses`, `employment_profiles`, `financial_profiles`, `documents`, `document_types`, `account_details`, `information_requests`, `application_events`, `admin_notes`, `communications`, `consents`, `audit_logs`, `loan_products`, `eligibility_rules`.

- All IDs are UUIDs. The public identifier is the random `reference`.
- Every table has `created_at`, and mutable tables also have `updated_at` (`timestamptz`).
- Indexes cover: application reference, applicant email, status, created date, country, admin email, and session/code token hashes.
- Money is stored as `numeric(14,2)` with an ISO-4217 currency code. Monthly-normalised income is stored for calculations.

## 8. Internationalisation

`src/config/countries.ts` builds the full ISO-3166 list with names from `Intl.DisplayNames`, plus per-country overrides for:

- address format (region label, postal code label and requirement)
- banking identifiers (IBAN countries, US routing, UK sort code, CA transit/institution, AU BSB, IN IFSC, generic account number + SWIFT fallback)

`src/config/currencies.ts` provides ISO-4217 currencies via `Intl.supportedValuesOf`. Nothing defaults to any single country. The country is chosen by the applicant, and amounts are formatted with `Intl.NumberFormat`.

## 9. Routes

| Area | Routes |
| --- | --- |
| Public | `/`, `/apply`, `/about`, `/contact`, `/legal/privacy`, `/legal/terms`, `/legal/disclaimer`, `/legal/cookies` |
| Applicant | `/portal/login`, `/portal/verify`, `/portal`, `/portal/applications/[id]` |
| Admin | `/admin` (login), `/admin/verify`, `/admin/dashboard`, `/admin/applications`, `/admin/applications/[id]`, `/admin/settings/{admins,products,documents}`, `/admin/audit` |
| API | `POST /api/uploads/sign`, `POST /api/uploads/complete`, `GET /api/documents/[id]`, `GET /api/cron/cleanup` |

Legal copy lives in versioned content modules (`src/content/legal`). Consents record the version the applicant accepted, so the copy can be updated without changing the code.

## 10. Directory layout

```
src/
  app/            routes (thin: fetch via lib, render components)
  components/     ui/ forms/ application/ admin/ portal/ marketing/
  config/         countries, currencies, site config
  content/        legal + FAQ copy
  db/             schema/, index.ts, seed data
  lib/            auth/ email/ cloudinary/ turnstile/ validation/ security/ application/ admin/ portal/
  styles/         tokens.css, globals
  types/
proxy.ts
```
