"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Field, Input } from "@/components/ui/Field";
import { Turnstile, type TurnstileHandle } from "./Turnstile";
import styles from "./PasswordlessLogin.module.css";

type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string };
type PlainResult = { ok: true } | { ok: false; error: string };

const PASSWORD_HINT = "At least 12 characters. A short phrase of several words works well.";

function PasswordInput({ id, describedBy, invalid, name, autoComplete, value, onChange }: {
  id: string;
  describedBy?: string;
  invalid: boolean;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.passwordWrap}>
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        aria-describedby={describedBy}
        invalid={invalid}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={128}
        spellCheck={false}
      />
      <button type="button" className={styles.reveal} onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

// --- Sign in -------------------------------------------------------------------

export function AdminLoginForm({ turnstileSiteKey, login, notice }: { turnstileSiteKey: string; login: (i: unknown) => Promise<AuthResult>; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const turnstileRef = useRef<TurnstileHandle>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return setError("Enter your email and password.");
    if (!token) return setError("Please complete the security check.");
    start(async () => {
      const res = await login({ email: email.trim().toLowerCase(), password, turnstileToken: token });
      turnstileRef.current?.reset();
      if (!res.ok) {
        setPassword("");
        return setError(res.error);
      }
      router.replace(res.redirectTo);
      router.refresh();
    });
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {notice && <Alert tone="warning">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Email address">
        {({ id, describedBy, invalid }) => (
          <Input id={id} type="email" aria-describedby={describedBy} invalid={invalid} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        )}
      </Field>
      <Field label="Password">
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} name="password" autoComplete="current-password" value={password} onChange={setPassword} />
        )}
      </Field>
      <Turnstile ref={turnstileRef} siteKey={turnstileSiteKey} action="admin_login" onToken={setToken} />
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Sign in
      </Button>
      <Link href="/admin/forgot-password" className={styles.back}>
        Forgot your password?
      </Link>
    </form>
  );
}

// --- Forgot password -------------------------------------------------------------

export function ForgotPasswordForm({ turnstileSiteKey, request }: { turnstileSiteKey: string; request: (i: unknown) => Promise<PlainResult> }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const turnstileRef = useRef<TurnstileHandle>(null);

  if (done) {
    return (
      <div className={styles.form}>
        <Alert tone="success" title="Check your email">
          If <strong>{email}</strong> belongs to an active administrator, we&apos;ve sent a link to reset the password. It expires in 30 minutes.
        </Alert>
        <Link href="/admin" className={styles.back}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!token) return setError("Please complete the security check.");
        start(async () => {
          const res = await request({ email: email.trim().toLowerCase(), turnstileToken: token });
          turnstileRef.current?.reset();
          if (!res.ok) return setError(res.error);
          setDone(true);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Email address">
        {({ id, describedBy, invalid }) => (
          <Input id={id} type="email" aria-describedby={describedBy} invalid={invalid} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
        )}
      </Field>
      <Turnstile ref={turnstileRef} siteKey={turnstileSiteKey} action="admin_login" onToken={setToken} />
      <Button type="submit" size="lg" fullWidth loading={pending}>
        Send reset link
      </Button>
      <Link href="/admin" className={styles.back}>
        Back to sign in
      </Link>
    </form>
  );
}

// --- Set password (invite / reset) ----------------------------------------------------

export function SetPasswordForm({ token, email, submit, submitLabel }: { token: string; email: string; submit: (i: unknown) => Promise<AuthResult>; submitLabel: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (password.length < 12) return setError("Use at least 12 characters.");
        if (password !== confirm) return setError("Passwords don't match.");
        start(async () => {
          const res = await submit({ token, password, confirm });
          if (!res.ok) return setError(res.error);
          router.replace(res.redirectTo);
          router.refresh();
        });
      }}
    >
      {/* Helps password managers associate the new password with the account. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="New password" hint={PASSWORD_HINT}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} name="password" autoComplete="new-password" value={password} onChange={setPassword} />
        )}
      </Field>
      <Field label="Confirm new password">
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} name="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        )}
      </Field>
      <Button type="submit" size="lg" fullWidth loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}

// --- Change password (signed in) --------------------------------------------------------

export function ChangePasswordForm({ email, submit }: { email: string; submit: (i: unknown) => Promise<PlainResult> }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);
        if (password !== confirm) return setError("Passwords don't match.");
        start(async () => {
          const res = await submit({ currentPassword: current, password, confirm });
          if (!res.ok) return setError(res.error);
          setCurrent("");
          setPassword("");
          setConfirm("");
          setSuccess(true);
        });
      }}
    >
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      {error && <Alert tone="danger">{error}</Alert>}
      {success && <Alert tone="success">Password updated. Other devices have been signed out.</Alert>}
      <Field label="Current password">
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} name="current" autoComplete="current-password" value={current} onChange={setCurrent} />
        )}
      </Field>
      <Field label="New password" hint={PASSWORD_HINT}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} name="password" autoComplete="new-password" value={password} onChange={setPassword} />
        )}
      </Field>
      <Field label="Confirm new password">
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} name="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
        )}
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          Update password
        </Button>
      </div>
    </form>
  );
}
