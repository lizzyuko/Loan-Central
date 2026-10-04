"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";

type Result = { ok: true; message: string } | { ok: false; error: string };

interface Props {
  action: (input: unknown) => Promise<Result>;
  /** Map form data to the action's input object. */
  toInput: (fd: FormData) => unknown;
  children: (pending: boolean) => ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  redirectTo?: string;
}

/** Small wrapper: submit -> server action -> toast / inline error. */
export function ActionForm({ action, toInput, children, className, resetOnSuccess, redirectTo }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const input = toInput(new FormData(form));
        setError(null);
        start(async () => {
          const res = await action(input);
          if (!res.ok) return setError(res.error);
          toast.show(res.message, "success");
          if (resetOnSuccess) form.reset();
          if (redirectTo) router.push(redirectTo);
        });
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {children(pending)}
    </form>
  );
}
