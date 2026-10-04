"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { FieldError } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { addNoteAction } from "@/app/admin/(console)/applications/[id]/actions";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={ref}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
      onSubmit={(e) => {
        e.preventDefault();
        const body = String(new FormData(e.currentTarget).get("body") ?? "");
        setError(null);
        start(async () => {
          const res = await addNoteAction({ applicationId, body });
          if (!res.ok) return setError(res.error);
          ref.current?.reset();
          toast.show("Note added", "success");
        });
      }}
    >
      <label htmlFor="note-body" className="visually-hidden">
        Private note
      </label>
      <Textarea id="note-body" name="body" rows={3} maxLength={5000} placeholder="Add a private note. Never visible to the applicant." required />
      {error && <FieldError>{error}</FieldError>}
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          Add note
        </Button>
      </div>
    </form>
  );
}
