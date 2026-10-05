/**
 * Baseline document types. These seed the `document_types` table, which super
 * admins can then edit. The wizard falls back to these labels if the table is
 * unavailable.
 */
export const DEFAULT_DOCUMENT_TYPES = [
  {
    key: "government_id_front",
    label: "Government-issued ID (front)",
    description: "The front of your passport photo page, national ID card or driving licence. All corners visible.",
  },
  {
    key: "government_id_back",
    label: "Government-issued ID (back)",
    description: "The back of your national ID card or driving licence. Not needed for a passport.",
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
export const DEFAULT_REQUIRED_DOCUMENTS = ["government_id_front", "proof_of_income"];

/**
 * Optional uploads shown next to a required one (e.g. the back of an ID card
 * alongside the front). Optional because passports have no back.
 */
export const COMPANION_DOCUMENTS: Record<string, string> = {
  government_id_front: "government_id_back",
};
