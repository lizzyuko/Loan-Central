"use client";

import { useState, useTransition } from "react";
import { DocumentUploadSlot } from "@/components/application/DocumentUploadSlot";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { Field, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { UploadedDocumentResult } from "@/lib/cloudinary/upload-client";
import { respondToRequestAction } from "@/app/portal/(app)/actions";

interface Props {
  applicationId: string;
  request: { id: string; message: string; requestedItems: string[] };
  documentTypes: { key: string; label: string; description: string }[];
  existing: UploadedDocumentResult[];
}

export function InfoRequestResponse({ applicationId, request, documentTypes, existing }: Props) {
  const toast = useToast();
  const [docs, setDocs] = useState<UploadedDocumentResult[]>(existing);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const items = request.requestedItems.length ? request.requestedItems : [];
  const missing = items.filter((k) => k !== "other" && !docs.some((d) => d.documentType === k));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Alert tone="warning" title="We need a little more information">
        <span style={{ whiteSpace: "pre-wrap" }}>{request.message}</span>
      </Alert>

      {items.map((key) => {
        const type = documentTypes.find((t) => t.key === key);
        return (
          <DocumentUploadSlot
            key={key}
            label={type?.label ?? key}
            description={type?.description}
            required={key !== "other"}
            context={{ documentType: key, applicationId, informationRequestId: request.id }}
            files={docs.filter((d) => d.documentType === key)}
            onUploaded={(d) => setDocs((all) => [...all, d])}
            removable={false}
          />
        );
      })}

      <Field label="Your response" optional={items.length > 0} hint="Add any explanation that helps our reviewer.">
        {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={4} />}
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <div>
        <Button
          loading={pending}
          disabled={missing.length > 0}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await respondToRequestAction({ applicationId, requestId: request.id, responseText: text });
              if (!res.ok) return setError(res.error);
              toast.show("Thank you. Your response has been sent to our team.", "success");
            })
          }
        >
          Send response
        </Button>
        {missing.length > 0 && <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Upload each requested document to continue.</p>}
      </div>
    </div>
  );
}
