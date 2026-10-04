import { randomBytes } from "node:crypto";

// Deterministic, test-only secrets (never used outside tests).
process.env.SESSION_SECRET ??= randomBytes(48).toString("base64");
process.env.ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
process.env.TURNSTILE_SECRET_KEY ??= "1x0000000000000000000000000000000AA";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
