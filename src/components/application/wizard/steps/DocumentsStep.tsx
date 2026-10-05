"use client";

import { useState, type FormEvent } from "react";
import { DocumentUploadSlot } from "@/components/application/DocumentUploadSlot";
import { Alert } from "@/components/ui/Feedback";
import { OTHER_DOCUMENT_TYPE } from "@/config/documents";
import { UPLOAD_RULES } from "@/config/site";
import { StepShell } from "../StepShell";
import type { UploadedDocument, WizardDocumentType } from "../types";

interface Props {
  documents: UploadedDocument[];
  requiredTypes: string[];
  documentTypes: WizardDocumentType[];
  onChange: (docs: UploadedDocument[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DocumentsStep({ documents, requiredTypes, documentTypes, onChange, onNext, onBack }: Props) {
  const [showErrors, setShowErrors] = useState(false);
  const typeMap = new Map(documentTypes.map((t) => [t.key, t]));
  const slots = [...new Set([...requiredTypes, OTHER_DOCUMENT_TYPE])].filter((k) => typeMap.has(k) || k === OTHER_DOCUMENT_TYPE);
  const missing = requiredTypes.filter((t) => !documents.some((d) => d.documentType === t));
  const atLimit = documents.length >= UPLOAD_RULES.maxFilesPerApplication;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (missing.length > 0) {
      setShowErrors(true);
      return;
    }
    onNext();
  }

  return (
    <StepShell
      title="Supporting documents"
      description="Clear photos or scans are fine. Your documents are stored privately and only our review team can see them."
      onSubmit={submit}
      onBack={onBack}
    >
      {showErrors && missing.length > 0 && (
        <Alert tone="danger" title="Some required documents are missing">
          Please upload: {missing.map((m) => typeMap.get(m)?.label ?? m).join(", ")}.
        </Alert>
      )}
      {atLimit && <Alert tone="info">You&apos;ve reached the maximum of {UPLOAD_RULES.maxFilesPerApplication} files.</Alert>}

      {slots.map((key) => {
        const type = typeMap.get(key);
        const files = documents.filter((d) => d.documentType === key);
        return (
          <DocumentUploadSlot
            key={key}
            label={type?.label ?? "Other supporting document"}
            description={type?.description}
            required={requiredTypes.includes(key)}
            context={{ documentType: key }}
            files={files}
            onUploaded={(doc) => onChange([...documents, doc])}
            onRemoved={(id) => onChange(documents.filter((d) => d.id !== id))}
            error={showErrors && requiredTypes.includes(key) && files.length === 0 ? "This document is required" : undefined}
          />
        );
      })}
    </StepShell>
  );
}
