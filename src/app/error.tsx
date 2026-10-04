"use client";

import { Button, LinkButton } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

/** Route-level error boundary. Never shows internal error details. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="Something went wrong"
      actions={
        <>
          <Button onClick={reset}>Try again</Button>
          <LinkButton href="/" variant="secondary">
            Back to home
          </LinkButton>
        </>
      }
    >
      We hit an unexpected problem loading this page. Your information is safe. Please try again in a moment.
    </ErrorState>
  );
}
