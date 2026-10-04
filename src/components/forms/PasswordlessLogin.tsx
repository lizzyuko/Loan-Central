"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Field";
import { Turnstile, type TurnstileHandle } from "./Turnstile";
import styles from "./PasswordlessLogin.module.css";

type ActionResult = { ok: true } | { ok: false; error: string };
type VerifyResult = { ok: true; redirectTo: string } | { ok: false; error: string };

interface Props {
  audience: "admin" | "applicant";
  turnstileSiteKey: string;
  requestCode: (input: { email: string; turnstileToken: string | null }) => Promise<ActionResult>;
  verifyCode: (input: { email: string; code: string }) => Promise<VerifyResult>;
  notice?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PasswordlessLogin({ audience, turnstileSiteKey, requestCode, verifyCode, notice }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const turnstileRef = useRef<TurnstileHandle>(null);

  function submitEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      setFieldError("Enter a valid email address");
      return;
    }
    setFieldError(null);
    if (!token) {
      setError("Please complete the security check.");
      return;
    }
    startTransition(async () => {
      const res = await requestCode({ email: normalized, turnstileToken: token });
      turnstileRef.current?.reset();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail(normalized);
      setStage("code");
    });
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setFieldError("Enter the 6-digit code from your email");
      return;
    }
    setFieldError(null);
    startTransition(async () => {
      const res = await verifyCode({ email, code: digits });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace(res.redirectTo);
      router.refresh();
    });
  }

  if (stage === "code") {
    return (
      <form className={styles.form} onSubmit={submitCode} noValidate>
        <Alert tone="info" title="Check your email">
          If <strong>{email}</strong> {audience === "admin" ? "is an authorised administrator" : "matches an application"}, we&apos;ve sent a
          6-digit code and a sign-in link. The code expires in 10 minutes.
        </Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Verification code" error={fieldError ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, "").slice(0, 7))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className={styles.code}
              autoFocus
            />
          )}
        </Field>
        <Button type="submit" size="lg" fullWidth loading={pending}>
          Verify and sign in
        </Button>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            setStage("email");
            setCode("");
            setError(null);
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Use a different email or resend
        </button>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={submitEmail} noValidate>
      {notice && <Alert tone="warning">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Field
        label="Email address"
        error={fieldError ?? undefined}
        hint={audience === "applicant" ? "Use the email address from your application." : undefined}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            aria-describedby={describedBy}
            invalid={invalid}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            autoFocus
          />
        )}
      </Field>
      <Turnstile ref={turnstileRef} siteKey={turnstileSiteKey} action={audience === "admin" ? "admin_login" : "portal_login"} onToken={setToken} />
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Send sign-in code
      </Button>
    </form>
  );
}
