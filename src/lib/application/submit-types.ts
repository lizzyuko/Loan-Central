/** Result of the public submit action (safe to send to the browser). */
export type SubmitApplicationResult =
  | { ok: true; reference: string; email: string }
  | {
      ok: false;
      error: string;
      /** Wizard step to send the user back to, if a section failed validation. */
      step?: "loan" | "personal" | "address" | "employment" | "financial" | "documents" | "review";
      /** Reset the bot check (token is single-use). */
      resetTurnstile?: boolean;
    };
