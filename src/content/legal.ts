import { siteConfig } from "@/config/site";

/**
 * Legal and disclosure copy. Each document carries a version; consents store
 * the version the applicant accepted. To update copy: edit the text, bump the
 * version and `updated` date. No code changes are needed elsewhere.
 *
 * IMPORTANT: this copy is a starting point written for a pre-qualification
 * service. It must be reviewed by qualified counsel for every jurisdiction you
 * operate in before production use.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  description: string;
  version: string;
  updated: string;
  sections: LegalSection[];
}

export type LegalSlug = "terms" | "privacy" | "disclaimer" | "cookies";

const contact = siteConfig.supportEmail;

/** Short disclosure used in the footer, wizard and emails. */
export const LOAN_DISCLAIMER =
  "Loan Central provides a pre-qualification and application review service. Submitting an application does not guarantee approval or a loan offer. Any eligibility update is an initial assessment, not a binding commitment to lend. Terms, availability and requirements vary by country.";

export const LEGAL_DOCUMENTS: Record<LegalSlug, LegalDocument> = {
  terms: {
    slug: "terms",
    title: "Terms of Use",
    description: "The terms that apply when you use Loan Central and submit an application.",
    version: "2026-10-01",
    updated: "1 October 2026",
    sections: [
      {
        heading: "About this service",
        paragraphs: [
          `${siteConfig.name} lets you submit information so our team can assess whether you may be eligible for loan options. We provide a pre-qualification review. We do not guarantee approval, a loan offer, or any particular terms.`,
        ],
      },
      {
        heading: "Your application",
        paragraphs: [
          "You agree that the information you provide is accurate, complete and your own. Providing false or misleading information may result in your application being declined and, where required, reported to the appropriate authorities.",
          "You must be at least 18 years old (or the age of majority where you live, if higher) to apply.",
        ],
      },
      {
        heading: "Eligibility decisions",
        paragraphs: [
          "Eligibility decisions are made by our review team. An eligibility update is an initial assessment and does not create a binding obligation for either party. Any loan would be subject to separate written terms that you would need to accept.",
        ],
      },
      {
        heading: "Availability",
        paragraphs: [
          "Loan options, amounts and requirements vary by country and may not be available where you live. We may decline to review applications from locations where we cannot offer a service.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "You agree not to misuse the service, including by submitting automated or fraudulent applications, attempting to access other people's information, or interfering with the security of the platform.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [`Questions about these terms can be sent to ${contact}.`],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    description: "How Loan Central collects, uses and protects your personal information.",
    version: "2026-10-01",
    updated: "1 October 2026",
    sections: [
      {
        heading: "Information we collect",
        paragraphs: [
          "Information you give us in your application: your name, date of birth, contact details, address, employment and income, financial commitments, and the documents you upload.",
          "If your application progresses and we ask for it, account details you provide through the secure applicant portal.",
          "Technical information needed to protect the service, such as a pseudonymised network identifier, browser type and security-check results.",
        ],
      },
      {
        heading: "How we use it",
        paragraphs: [
          "To review your application, communicate with you about it, verify your identity when you sign in, prevent fraud and abuse, and meet legal obligations.",
          "We do not sell your personal information.",
        ],
      },
      {
        heading: "How we protect it",
        paragraphs: [
          "Access to applications is restricted to authorised reviewers and every access to sensitive information is logged. Documents are stored privately and are only viewable through short-lived, authorised links. Account details are encrypted at rest and are never included in emails.",
        ],
      },
      {
        heading: "Service providers",
        paragraphs: [
          "We use trusted providers to operate the service, including hosting, database, email delivery, document storage and bot protection. They process information on our behalf and only as needed to provide their services.",
        ],
      },
      {
        heading: "Retention",
        paragraphs: [
          "We keep application information for as long as needed to review it and meet legal obligations. Account details are deleted after a defined retention period once they are no longer needed.",
        ],
      },
      {
        heading: "Your choices",
        paragraphs: [
          `Depending on where you live, you may have rights to access, correct or delete your information. Contact ${contact} to make a request.`,
        ],
      },
    ],
  },
  disclaimer: {
    slug: "disclaimer",
    title: "Loan Disclosure",
    description: "Important information about what a Loan Central eligibility update means.",
    version: "2026-10-01",
    updated: "1 October 2026",
    sections: [
      { heading: "Pre-qualification only", paragraphs: [LOAN_DISCLAIMER] },
      {
        heading: "No guarantee",
        paragraphs: [
          "We do not guarantee approval, interest rates, repayment terms or any credit outcome. Any loan offer, if made, would be provided separately in writing with its full terms.",
        ],
      },
      {
        heading: "Your responsibility",
        paragraphs: [
          "Borrowing is a serious commitment. Only borrow what you can afford to repay, and consider seeking independent financial advice.",
        ],
      },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Cookies & Privacy Information",
    description: "The cookies Loan Central uses and why.",
    version: "2026-10-01",
    updated: "1 October 2026",
    sections: [
      {
        heading: "Essential cookies only",
        paragraphs: [
          "We use a small number of strictly necessary cookies to keep you signed in securely to the applicant portal or admin area, and to connect documents you upload to your application before you submit it. These cookies are HTTP-only and cannot be read by scripts on the page.",
          "We do not use advertising or cross-site tracking cookies.",
        ],
      },
      {
        heading: "Security checks",
        paragraphs: [
          "Cloudflare Turnstile helps us block automated abuse on forms. It may process technical signals from your browser for that purpose.",
        ],
      },
      {
        heading: "Saved progress",
        paragraphs: [
          "While you complete the application, your answers are saved in your browser's session storage so a refresh doesn't lose your progress. They are cleared when you submit or close the tab.",
        ],
      },
    ],
  },
};

export const CONSENT_VERSIONS = {
  terms: LEGAL_DOCUMENTS.terms.version,
  privacy: LEGAL_DOCUMENTS.privacy.version,
  disclosure: LEGAL_DOCUMENTS.disclaimer.version,
  accuracy: LEGAL_DOCUMENTS.terms.version,
} as const;
