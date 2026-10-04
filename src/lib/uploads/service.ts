import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { documents, documentTypes, informationRequests } from "@/db/schema";
import { UPLOAD_RULES } from "@/config/site";
import { recordAudit, recordEvent } from "@/lib/audit";
import { getCurrentApplicant, getOwnedApplicationId } from "@/lib/auth/applicant";
import { deleteAsset, getAsset, signUpload, type SignedUpload } from "@/lib/cloudinary/server";
import { generateToken } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { checkFile, sanitizeFilename } from "@/lib/validation/upload";
import { applicationFolder, draftFolder, getDraftTokenHash, getOrCreateDraftTokenHash } from "./draft";

export class UploadRejected extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

/** Where an upload belongs: a pre-submission draft, or an existing application (portal). */
type UploadTarget =
  | { kind: "draft"; draftHash: string; folder: string }
  | { kind: "application"; applicationId: string; applicantId: string; informationRequestId: string | null; folder: string };

interface TargetInput {
  applicationId?: string;
  informationRequestId?: string;
}

async function resolveTarget(input: TargetInput, createDraft: boolean): Promise<UploadTarget> {
  if (input.applicationId) {
    const applicant = await getCurrentApplicant();
    if (!applicant) throw new UploadRejected("Your session has expired. Please sign in again.", 401);
    const owned = await getOwnedApplicationId(applicant.id, input.applicationId);
    if (!owned) throw new UploadRejected("Application not found.", 404);

    let informationRequestId: string | null = null;
    if (input.informationRequestId) {
      const [req] = await getDb()
        .select({ id: informationRequests.id })
        .from(informationRequests)
        .where(
          and(
            eq(informationRequests.id, input.informationRequestId),
            eq(informationRequests.applicationId, owned),
            eq(informationRequests.status, "OPEN"),
          ),
        );
      if (!req) throw new UploadRejected("This information request is no longer open.", 409);
      informationRequestId = req.id;
    }
    return { kind: "application", applicationId: owned, applicantId: applicant.id, informationRequestId, folder: applicationFolder(owned) };
  }

  const draftHash = createDraft ? await getOrCreateDraftTokenHash() : await getDraftTokenHash();
  if (!draftHash) throw new UploadRejected("Your upload session has expired. Please refresh and try again.", 401);
  return { kind: "draft", draftHash, folder: draftFolder(draftHash) };
}

async function assertDocumentType(key: string) {
  const [row] = await getDb()
    .select({ key: documentTypes.key })
    .from(documentTypes)
    .where(and(eq(documentTypes.key, key), eq(documentTypes.isActive, true)));
  if (!row) throw new UploadRejected("Unknown document type.");
}

async function assertCapacity(target: UploadTarget) {
  const db = getDb();
  const where =
    target.kind === "draft"
      ? and(eq(documents.draftTokenHash, target.draftHash), eq(documents.status, "PENDING"), isNull(documents.applicationId))
      : and(eq(documents.applicationId, target.applicationId), eq(documents.status, "ATTACHED"));
  const [row] = await db.select({ n: count() }).from(documents).where(where);
  const limit = target.kind === "draft" ? UPLOAD_RULES.maxFilesPerApplication : UPLOAD_RULES.maxFilesPerApplication * 2;
  if ((row?.n ?? 0) >= limit) throw new UploadRejected("You've reached the maximum number of files.", 409);
}

export async function prepareUpload(input: {
  documentType: string;
  filename: string;
  bytes: number;
  mimeType: string;
} & TargetInput): Promise<SignedUpload> {
  const check = checkFile(input);
  if (!check.ok) throw new UploadRejected(check.error);
  await assertDocumentType(input.documentType);
  const target = await resolveTarget(input, true);
  await assertCapacity(target);
  // Random public id: the original filename never appears in storage paths.
  const publicId = `${target.folder}/${generateToken(18)}`;
  return signUpload({ publicId, allowedFormats: Object.keys(UPLOAD_RULES.allowedFormats) });
}

export interface RecordedDocument {
  id: string;
  documentType: string;
  filename: string;
  bytes: number;
}

export async function completeUpload(input: { documentType: string; filename: string; publicId: string } & TargetInput): Promise<RecordedDocument> {
  await assertDocumentType(input.documentType);
  const target = await resolveTarget(input, false);

  // The asset must live in the folder we signed for this draft/application.
  if (!input.publicId.startsWith(`${target.folder}/`) || input.publicId.includes("..")) {
    throw new UploadRejected("Upload could not be verified.", 403);
  }

  // Trust Cloudinary's stored metadata, not the browser's claims.
  const asset = await getAsset(input.publicId);
  if (!asset) throw new UploadRejected("Upload could not be verified. Please try again.");
  const mimeType = UPLOAD_RULES.allowedFormats[asset.format];
  if (!mimeType || asset.bytes > UPLOAD_RULES.maxBytes || asset.type !== "authenticated") {
    await deleteAsset(input.publicId).catch(() => undefined);
    throw new UploadRejected("This file type or size isn't allowed.");
  }

  const filename = sanitizeFilename(input.filename);
  const db = getDb();
  try {
    const [doc] = await db
      .insert(documents)
      .values({
        applicationId: target.kind === "application" ? target.applicationId : null,
        draftTokenHash: target.kind === "draft" ? target.draftHash : null,
        informationRequestId: target.kind === "application" ? target.informationRequestId : null,
        documentType: input.documentType,
        originalFilename: filename,
        mimeType,
        bytes: asset.bytes,
        cloudinaryPublicId: asset.publicId,
        cloudinaryResourceType: "image",
        cloudinaryFormat: asset.format,
        cloudinaryVersion: asset.version,
        status: target.kind === "application" ? "ATTACHED" : "PENDING",
        uploadedBy: "APPLICANT",
      })
      .returning({ id: documents.id });
    if (!doc) throw new Error("insert failed");

    if (target.kind === "application") {
      const actor = { type: "APPLICANT" as const, applicantId: target.applicantId };
      await recordEvent({
        applicationId: target.applicationId,
        type: "document.uploaded",
        summary: "Applicant uploaded a document",
        actor,
        metadata: { documentType: input.documentType },
      });
      await recordAudit({ actor, action: "document.uploaded", applicationId: target.applicationId, targetType: "document", targetId: doc.id });
    }
    return { id: doc.id, documentType: input.documentType, filename, bytes: asset.bytes };
  } catch (err) {
    if (isUniqueViolation(err, "documents_public_id_idx")) throw new UploadRejected("This upload was already recorded.", 409);
    logger.error("Recording upload failed", { err });
    throw new UploadRejected("Document upload failed. Please try again.", 500);
  }
}

/** Remove a pre-submission draft upload (only by the browser that uploaded it). */
export async function deleteDraftUpload(documentId: string): Promise<boolean> {
  const draftHash = await getDraftTokenHash();
  if (!draftHash) return false;
  const db = getDb();
  const [doc] = await db
    .select({ id: documents.id, publicId: documents.cloudinaryPublicId })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.draftTokenHash, draftHash), eq(documents.status, "PENDING"), isNull(documents.applicationId)));
  if (!doc) return false;
  await deleteAsset(doc.publicId).catch((err) => logger.warn("Cloudinary delete failed", { err }));
  await db.update(documents).set({ status: "DELETED", draftTokenHash: null }).where(eq(documents.id, doc.id));
  return true;
}
