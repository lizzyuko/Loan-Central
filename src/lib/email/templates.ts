import { siteConfig } from "@/config/site";
import { button, codeBlock, detailRows, escapeHtml, list, p, paragraphs, renderLayout, type EmailContent } from "./layout";

/**
 * Transactional email templates. Rules:
 *  - no account/bank data, no document links, no internal notes
 *  - every dynamic value escaped
 *  - each template also returns a plain-text version
 */

const SIGN_OFF = `The ${siteConfig.name} team`;

function signOff(): string {
  return p(`Kind regards,<br>${escapeHtml(SIGN_OFF)}`);
}

function greet(firstName?: string): string {
  return firstName ? `Hi ${firstName},` : "Hello,";
}

// --- Authentication -----------------------------------------------------------

export function verificationEmail(opts: { code: string; link: string; minutes: number; audience: "admin" | "applicant" }): EmailContent {
  const subject = `Your ${siteConfig.name} verification code`;
  const where = opts.audience === "admin" ? "the admin dashboard" : "your applicant portal";
  const html = renderLayout({
    preheader: `Your code is ${opts.code}. It expires in ${opts.minutes} minutes.`,
    heading: "Your verification code",
    body: [
      p(`Use this code to sign in to ${escapeHtml(where)}. It expires in ${opts.minutes} minutes and can only be used once.`),
      codeBlock(opts.code),
      p("Or sign in with this one-time link:"),
      button("Sign in securely", opts.link),
      p(`If you didn't request this, you can ignore this email. Someone may have entered your address by mistake.`),
    ].join(""),
  });
  const text = `Your ${siteConfig.name} verification code is ${opts.code}. It expires in ${opts.minutes} minutes.\n\nOr sign in with this one-time link: ${opts.link}\n\nIf you didn't request this, ignore this email.`;
  return { subject, html, text };
}

// --- Applicant lifecycle ------------------------------------------------------

export function applicationConfirmationEmail(opts: { firstName: string; reference: string; portalUrl: string }): EmailContent {
  const subject = `We've received your ${siteConfig.name} application`;
  const html = renderLayout({
    preheader: `Reference ${opts.reference}. Here's what happens next.`,
    heading: "We've received your application",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`Thank you for applying with ${escapeHtml(siteConfig.name)}. Your application has been submitted and is waiting for review.`),
      detailRows([
        ["Reference", opts.reference],
        ["Typical review time", siteConfig.typicalReviewTime],
      ]),
      p("<strong>What happens next</strong>"),
      list([
        "A member of our team will review your application and documents.",
        "If we need more information, we'll email you with exactly what's needed.",
        "We'll email you when there's an update on your eligibility.",
      ]),
      p("You can check your application status at any time:"),
      button("View your application", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nThank you for applying with ${siteConfig.name}. Your reference is ${opts.reference}.\n\nA member of our team will review your application, usually within ${siteConfig.typicalReviewTime}. We'll email you with any updates.\n\nCheck your status: ${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function underReviewEmail(opts: { firstName: string; reference: string; portalUrl: string }): EmailContent {
  const subject = `Your ${siteConfig.name} application is under review`;
  const html = renderLayout({
    preheader: `A reviewer is now looking at application ${opts.reference}.`,
    heading: "Your application is under review",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`A member of our team is now reviewing application <strong>${escapeHtml(opts.reference)}</strong>. We'll be in touch as soon as there's an update.`),
      button("View your application", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nA member of our team is now reviewing application ${opts.reference}. We'll be in touch as soon as there's an update.\n\n${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function moreInformationEmail(opts: {
  firstName: string;
  reference: string;
  message: string;
  items: string[];
  portalUrl: string;
}): EmailContent {
  const subject = "Additional information required for your application";
  const html = renderLayout({
    preheader: `We need a little more information to continue reviewing ${opts.reference}.`,
    heading: "We need a little more information",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`To continue reviewing application <strong>${escapeHtml(opts.reference)}</strong>, we need the following:`),
      opts.items.length ? list(opts.items) : "",
      paragraphs(opts.message),
      p("Please sign in to your applicant portal to respond and upload any documents. Don't reply to this email with documents."),
      button("Provide information", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nTo continue reviewing application ${opts.reference}, we need:\n${opts.items.map((i) => `- ${i}`).join("\n")}\n\n${opts.message}\n\nRespond securely in your portal: ${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function eligibilityEmail(opts: {
  firstName: string;
  reference: string;
  eligible: boolean;
  message?: string;
  portalUrl: string;
}): EmailContent {
  const subject = `An update on your ${siteConfig.name} application`;
  const intro = opts.eligible
    ? `Based on our initial review of application <strong>${escapeHtml(opts.reference)}</strong>, you may be eligible to continue. We'll contact you about the next steps.`
    : `Thank you for your patience. After careful review of application <strong>${escapeHtml(opts.reference)}</strong>, we're unable to move forward with it at this time.`;
  const note = opts.eligible
    ? "This is a pre-qualification update, not a loan offer or a guarantee of approval."
    : "This decision relates only to this application. You're welcome to apply again in the future if your circumstances change.";
  const html = renderLayout({
    preheader: "There's an update on your application.",
    heading: "An update on your application",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(intro),
      opts.message ? paragraphs(opts.message) : "",
      p(`<span style="color:#5f6b76;font-size:14px;">${escapeHtml(note)}</span>`),
      button("View your application", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const plainIntro = opts.eligible
    ? `Based on our initial review of application ${opts.reference}, you may be eligible to continue. We'll contact you about next steps.`
    : `After careful review of application ${opts.reference}, we're unable to move forward with it at this time.`;
  const text = `${greet(opts.firstName)}\n\n${plainIntro}\n\n${opts.message ? `${opts.message}\n\n` : ""}${note}\n\n${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function accountDetailsRequestEmail(opts: { firstName: string; reference: string; message?: string; portalUrl: string }): EmailContent {
  const subject = `Next step for your ${siteConfig.name} application`;
  const html = renderLayout({
    preheader: "Your application has progressed to the next stage.",
    heading: "Your application has progressed",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`Application <strong>${escapeHtml(opts.reference)}</strong> has progressed to the next stage. To continue, please provide the requested account information through your secure applicant portal.`),
      opts.message ? paragraphs(opts.message) : "",
      button("Continue securely", opts.portalUrl),
      p(`<strong>For your security:</strong> never send bank details by email. We will only ever collect them in the portal after you sign in with a one-time code.`),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nApplication ${opts.reference} has progressed to the next stage. Please provide the requested account information in your secure portal: ${opts.portalUrl}\n\nNever send bank details by email.\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function statusUpdateEmail(opts: { firstName: string; reference: string; statusText: string; portalUrl: string }): EmailContent {
  const subject = `An update on your ${siteConfig.name} application`;
  const html = renderLayout({
    preheader: "There's an update on your application.",
    heading: "An update on your application",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`Application <strong>${escapeHtml(opts.reference)}</strong>: ${escapeHtml(opts.statusText)}`),
      button("View your application", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nApplication ${opts.reference}: ${opts.statusText}\n\n${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function generalMessageEmail(opts: { firstName: string; reference: string; subject: string; message: string; portalUrl: string }): EmailContent {
  const html = renderLayout({
    preheader: `A message about application ${opts.reference}.`,
    heading: opts.subject,
    body: [
      p(escapeHtml(greet(opts.firstName))),
      paragraphs(opts.message),
      p(`<span style="color:#5f6b76;font-size:14px;">Regarding application ${escapeHtml(opts.reference)}.</span>`),
      button("View in your portal", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\n${opts.message}\n\nRegarding application ${opts.reference}.\n${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject: opts.subject, html, text };
}

// --- Internal -----------------------------------------------------------------

export function adminNewApplicationEmail(opts: { reference: string; amount: string; productName: string; country: string; adminUrl: string }): EmailContent {
  const subject = `New application ${opts.reference}`;
  const html = renderLayout({
    preheader: `${opts.reference} is waiting for review.`,
    heading: "New application received",
    body: [
      p("A new application has been submitted and is waiting for review."),
      detailRows([
        ["Reference", opts.reference],
        ["Loan type", opts.productName],
        ["Requested", opts.amount],
        ["Country", opts.country],
      ]),
      button("Review application", opts.adminUrl),
    ].join(""),
    footnote: "Internal notification. Applicant details are only available in the admin dashboard.",
  });
  const text = `New application ${opts.reference} (${opts.productName}, ${opts.amount}, ${opts.country}).\n\nReview: ${opts.adminUrl}`;
  return { subject, html, text };
}
