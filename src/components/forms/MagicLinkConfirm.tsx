"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";

type VerifyResult = { ok: true; redirectTo: string } | { ok: false; error: string };

/**
 * The magic link lands on a page that requires a click, so automated link
 * scanners in email clients (which only issue GET requests) can't consume
 * the single-use token.
 */
export function MagicLinkConfirm({
  token,
  verify,
  retryHref,
}: {
  token: string;
  verify: (input: { token: string }) => Promise<VerifyResult>;
  retryHref: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {error ? (
        <>
          <Alert tone="danger" title="We couldn't sign you in">
            {error}
          </Alert>
          <Link href={retryHref}>Request a new code</Link>
        </>
      ) : (
        <Button
          size="lg"
          fullWidth
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await verify({ token });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.replace(res.redirectTo);
              router.refresh();
            })
          }
        >
          Continue to sign in
        </Button>
      )}
    </div>
  );
}
