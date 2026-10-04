/**
 * Baseline document types. These seed the `document_types` table, which super
 * admins can then edit. The wizard falls back to these labels if the table is
 * unavailable.
 */
export const DEFAULT_DOCUMENT_TYPES = [
  {
    key: "government_id",
    label: "Government-issued ID",
    description: "Passport, national ID card or driving licence. All corners visible.",
  },
  {
    key: "proof_of_income",
    label: "Proof of income",
    description: "Recent payslips, a tax return or bank statements showing income.",
  },
  {
    key: "proof_of_address",
    label: "Proof of address",
    description: "A utility bill or bank statement from the last 3 months.",
  },
  {
    key: "employment_document",
    label: "Employment documentation",
    description: "Employment contract, offer letter or business registration.",
  },
  {
    key: "other",
    label: "Other supporting document",
    description: "Anything else that supports your application.",
  },
] as const;

export const OTHER_DOCUMENT_TYPE = "other";

/** Required when no product (or no product configuration) applies. */
export const DEFAULT_REQUIRED_DOCUMENTS = ["government_id", "proof_of_income"];
