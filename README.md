# Loan Central

International loan pre-qualification and application platform. Applicants apply through a guided wizard, administrators review applications in a private dashboard, and applicants who progress provide account details through a secure portal.

> Loan Central provides a pre-qualification review. Submitting an application does not guarantee approval or a loan offer.

- **Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), CSS Modules, React Hook Form + Zod, Drizzle ORM on Neon Postgres, Resend, Cloudinary, Cloudflare Turnstile. Deployed on Vercel.
- **Architecture:** see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the auth model, data flow, schema and security design.

---

## Quick start (local)

Requirements: Node.js 20.9+ and a Neon (or any Postgres 15+) database.

```bash
git clone https://github.com/lizzyuko/Loan-Central.git
cd Loan-Central
npm install
cp .env.example .env.local      # then fill in values (see below)
npm run db:migrate              # create tables
npm run db:seed -- --dev        # reference data + demo admins + sample applications
npm run dev                     # http://localhost:3000
```

**Minimum `.env.local` for local development:**

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Your Neon connection string |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` (Cloudflare test key, always passes) |
| `TURNSTILE_SECRET_KEY` | `1x0000000000000000000000000000000AA` |
| `DEV_EMAIL_CONSOLE` | `true`, which prints emails (invite and reset links, portal sign-in codes) to the terminal while Resend isn't configured. **Development only.** It is ignored in production. |

Then sign in at `/admin` as `super.admin@loancentral.test` (super admin) or `reviewer@loancentral.test` (admin), password `loan-central-dev-only`. These demo accounts exist only with `--dev` and are refused in production.

Document uploads need Cloudinary credentials, even locally.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit tests (integration tests run when `TEST_DATABASE_URL` is set) |
| `npm run db:generate` | Generate a migration after editing `src/db/schema` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Reference data only: document types, loan products, advisory rules, and the first super admin from `SEED_ADMIN_*`. Safe in production. |
| `npm run db:seed -- --dev` | Also adds demo admins and sample applications. Refused when `NODE_ENV=production`. |
| `npm run db:studio` | Browse the database |

---

## Service setup

### Neon (database)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string (the host contains `-pooler`) into `DATABASE_URL`.
3. Optionally copy the direct (non-pooled) string into `DATABASE_URL_UNPOOLED`. Migrations use it when present.
4. Run `npm run db:migrate`, then `npm run db:seed`.
5. For integration tests, create a separate Neon **branch** and set `TEST_DATABASE_URL` to it. The tests truncate tables.

### Resend (email)

1. Create an account at [resend.com](https://resend.com) and **verify your sending domain** (it gives you the SPF and DKIM DNS records to add).
2. Create an API key and set `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL`, for example `Loan Central <noreply@yourdomain.com>`, using the verified domain. Optionally set `RESEND_REPLY_TO`.

Every email is recorded in the `communications` table with its delivery status. If an email fails, the business action (submission, status change) still completes, and the failure is shown on the application timeline.

### Cloudinary (documents)

1. Create an account at [cloudinary.com](https://cloudinary.com). From the dashboard, copy `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
2. No upload preset is needed. Uploads are signed server-side and stored as **`authenticated` (private)** assets under `loan-central/`.
3. Admins view documents through `/api/documents/[id]`, which checks permissions, writes an audit entry, then redirects to a signed download URL that expires after 5 minutes. Document URLs never appear in pages.

### Cloudflare Turnstile (bot protection)

1. In the Cloudflare dashboard, go to **Turnstile** and **Add widget**. Add your production domain (and `localhost` if you want real checks locally).
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
3. Turnstile protects application submission, admin sign-in, password-reset requests and portal sign-in. Tokens are always verified server-side, including the expected action.

### Rate limiting

There's nothing to set up. Limits are counted in the `rate_limits` table in Postgres, and the daily cron clears old counters. If the database can't be reached, rate-limited actions are refused (fail closed).

---

## Deploying to Vercel

1. Import the repository in Vercel. The framework (Next.js) is detected automatically.
2. Add every variable from `.env.example` under **Project → Settings → Environment Variables**, with real production values:
   - `NEXT_PUBLIC_APP_URL`: your production URL, with no trailing slash
   - `CRON_SECRET`: a random string. Vercel Cron sends it to `/api/cron/cleanup`.
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (12+ characters) and optionally `SEED_ADMIN_NAME`: your first super admin account
   - leave `DEV_EMAIL_CONSOLE` unset
3. Deploy. Vercel runs the `vercel-build` script, which applies pending migrations and seeds reference data (idempotent) before `next build`, so a fresh Neon database is set up automatically. `DATABASE_URL` must be set for **Preview** and **Production**, otherwise the build fails. Point Preview at a separate Neon branch if you don't want previews migrating the production database.
4. After deploying: `vercel.json` schedules the daily cleanup job (03:00 UTC), which:
   - removes abandoned uploads
   - removes expired codes and sessions
   - purges encrypted account details once their retention period ends

**First administrator:** the deploy's seed step creates a super admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Sign in at `/admin` with those credentials. Later deploys never overwrite that password, so you can change it under **Your account**, and you can delete `SEED_ADMIN_PASSWORD` from Vercel afterwards.

**More administrators:** go to **Settings → Administrators → Invite**. The invitee gets an email link (valid for 7 days) to set their own password. Anyone can use **Forgot your password?** on the sign-in page; reset links expire after 30 minutes and sign out every other session.

---

## How it works

**Applicants**
1. They complete `/apply` (7 steps). Progress is saved in `sessionStorage`, so a refresh doesn't lose answers.
2. Documents upload directly to Cloudinary through signed requests, tied to an HTTP-only draft cookie.
3. On submit, the server:
   - re-validates everything and verifies Turnstile
   - checks idempotency and duplicate-submission rules
   - writes the application in one transaction
   - generates a random `LC-YYYY-NNNNNN` reference
   - emails the applicant and the admins
4. Applicants track progress at `/portal`, signing in with a one-time code or magic link. There they can answer information requests and, once invited, submit account details.

**Administrators**
1. They sign in at `/admin` with email and password. Accounts are created only by invitation from a super admin.
2. The dashboard and application list support search, filters, sorting and pagination.
3. On the application detail page, admins can:
   - review everything and open documents securely
   - see advisory indicators (age, debt-to-income, documents)
   - add private notes and read the full timeline
4. Available actions: **Request more information**, **Mark eligible** or **Mark not eligible**, **Request account details**, **Send message**, and **Change status**. Every action is audited and enforced against the status state machine.

**Roles:** `ADMIN` reviews and communicates. `SUPER_ADMIN` can also:
- manage administrators, loan products and document types
- view the audit log
- reveal encrypted account details (audited)

## Security summary

- **Admins:** passwords are hashed with scrypt. The account locks for 15 minutes after 5 failures. Invite and reset tokens are single-use, hashed and short-lived, and a reset revokes all sessions.
- **Applicants:** passwordless sign-in with hashed, single-use, 10-minute codes, limited to 5 attempts.
- Sign-in is rate-limited and protected by Turnstile. Error messages are generic, so they don't reveal which emails exist.
- Sessions are stored in the database with HTTP-only `SameSite=Lax` cookies (`Secure` in production). They have absolute and idle expiry, and logout revokes them.
- Every page, action and route handler re-checks authorization through the data access layer. `proxy.ts` only does an optimistic redirect.
- Applicants only ever query records scoped to their own `applicant_id`. Knowing an ID grants nothing.
- Account identifiers are encrypted with AES-256-GCM, masked in the UI, never emailed or logged, and purged after the retention period.
- Security headers include CSP, HSTS, frame denial, nosniff, and Referrer-Policy. Private routes are `noindex` and `no-store`.
- Logs use structured logging that redacts sensitive keys. IP addresses are stored only as keyed hashes.

## Customising

| What | Where |
| --- | --- |
| Legal and disclosure copy (versioned; consents record the version) | `src/content/legal.ts` |
| FAQ | `src/content/faq.ts` |
| Countries, address formats, banking schemes | `src/config/countries.ts`, `src/config/banking.ts` |
| Currencies | `src/config/currencies.ts` |
| Loan purposes, upload rules, retention | `src/config/site.ts` |
| Design tokens (colours, type, spacing, dark mode) | `src/styles/tokens.css` |
| Loan products, document types | Admin UI (super admin) |

> **Legal copy is a starting point.** Have it reviewed by qualified counsel for each jurisdiction you operate in before going live.
