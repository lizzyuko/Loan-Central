"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle, FileText, Trash, UploadSimple } from "@phosphor-icons/react";
import { UPLOAD_RULES } from "@/config/site";
import { checkFile } from "@/lib/validation/upload";
import { deleteDraftDocument, uploadDocument, type UploadContext, type UploadedDocumentResult } from "@/lib/cloudinary/upload-client";
import { FieldError } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { cx } from "@/components/ui/cx";
import styles from "./DocumentUploadSlot.module.css";

interface Props {
  label: string;
  description?: string;
  required?: boolean;
  context: UploadContext;
  files: UploadedDocumentResult[];
  onUploaded: (doc: UploadedDocumentResult) => void;
  onRemoved?: (id: string) => void;
  /** Whether files can be removed (pre-submission drafts only). */
  removable?: boolean;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentUploadSlot({ label, description, required, context, files, onUploaded, onRemoved, removable = true, error }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleFiles(list: FileList | null) {
    const file = list?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setLocalError(null);
    const check = checkFile({ filename: file.name, bytes: file.size, mimeType: file.type });
    if (!check.ok) {
      setLocalError(check.error);
      return;
    }
    setProgress(0);
    try {
      const doc = await uploadDocument(file, context, setProgress);
      onUploaded(doc);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Document upload failed. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    setLocalError(null);
    try {
      await deleteDraftDocument(id);
      onRemoved?.(id);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Couldn't remove the file.");
    } finally {
      setRemoving(null);
    }
  }

  const shownError = localError ?? error;
  const uploading = progress !== null;
  const hasFiles = files.length > 0;

  return (
    <div className={cx(styles.slot, hasFiles && styles.complete, shownError && styles.invalid)}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          {hasFiles ? <CheckCircle size={22} weight="fill" /> : <FileText size={22} />}
        </span>
        <div className={styles.text}>
          <p className={styles.label}>
            {label} {required ? <span className={styles.req}>Required</span> : <span className={styles.opt}>Optional</span>}
          </p>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>

      {hasFiles && (
        <ul className={styles.files}>
          {files.map((f) => (
            <li key={f.id} className={styles.file}>
              <FileText size={16} aria-hidden="true" />
              <span className={styles.fileName}>{f.filename}</span>
              <span className={styles.fileSize}>{formatBytes(f.bytes)}</span>
              {removable && onRemoved && (
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => remove(f.id)}
                  disabled={removing === f.id}
                  aria-label={`Remove ${f.filename}`}
                >
                  {removing === f.id ? <Spinner size={14} /> : <Trash size={16} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.controls}>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={UPLOAD_RULES.accept}
          className="visually-hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
        <label htmlFor={inputId} className={cx(styles.uploadButton, uploading && styles.busy)} aria-disabled={uploading || undefined}>
          {uploading ? <Spinner size={16} /> : <UploadSimple size={16} />}
          {uploading ? `Uploading ${progress}%` : hasFiles ? "Add another file" : "Upload file"}
        </label>
        <span className={styles.rules}>PDF, JPG, PNG, WEBP or HEIC, up to {Math.round(UPLOAD_RULES.maxBytes / 1024 / 1024)} MB</span>
      </div>
      {uploading && (
        <div className={styles.bar} role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${label}`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {shownError && <FieldError>{shownError}</FieldError>}
    </div>
  );
}
