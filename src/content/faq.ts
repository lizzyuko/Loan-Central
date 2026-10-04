import { siteConfig } from "@/config/site";

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How does the application process work?",
    answer:
      "You complete a short online application covering the loan you're looking for, your personal details, address, income and finances, and upload a few supporting documents. Our team reviews it and emails you with an eligibility update. If you may be eligible, we'll invite you to continue securely through your applicant portal.",
  },
  {
    question: "Does submitting an application guarantee approval?",
    answer:
      "No. Submitting an application does not guarantee approval or a loan offer. Our first decision is a pre-qualification assessment based on the information you provide. Any final outcome depends on further review.",
  },
  {
    question: "How long does review take?",
    answer: `Most applications receive an initial update within ${siteConfig.typicalReviewTime}. If we need more information, the review resumes as soon as you provide it.`,
  },
  {
    question: "What information will I need?",
    answer:
      "Your contact details, date of birth, address, employment and income information, and an outline of your monthly commitments. You'll also need clear copies of documents such as a government-issued ID and recent proof of income. It usually takes about 10 minutes.",
  },
  {
    question: "When will I provide account details?",
    answer:
      "Only if your application progresses past our initial review. We never ask for bank or payment details in the initial application. If we need them, we'll invite you to provide them securely through your applicant portal, never by email.",
  },
  {
    question: "Can I save and return to my application?",
    answer:
      "Your progress is saved in this browser while you complete the form, so you can refresh or step away briefly without losing your answers. Once you submit, you can sign in to the applicant portal at any time with a one-time code sent to your email.",
  },
  {
    question: "What happens if more information is required?",
    answer:
      "We'll email you explaining exactly what we need. Sign in to your applicant portal to reply and upload any requested documents. Your application goes back into review as soon as you respond.",
  },
];
