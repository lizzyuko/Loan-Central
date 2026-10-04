import { siteConfig } from "@/config/site";
import { button, detailRows, escapeHtml, list, p, paragraphs, renderLayout, type EmailContent } from "./layout";

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

// --- Administrator accounts ---------------------------------------------------

export function adminInviteEmail(opts: { name: string; inviterName: string; link: string; days: number }): EmailContent {
  const subject = `You've been invited to the ${siteConfig.name} admin dashboard`;
  const html = renderLayout({
    preheader: `${opts.inviterName} invited you to review applications on ${siteConfig.name}.`,
    heading: "You've been invited",
    body: [
      p(escapeHtml(greet(opts.name))),
      p(`${escapeHtml(opts.inviterName)} has invited you to join the ${escapeHtml(siteConfig.name)} admin dashboard. Set your password to activate your account.`),
      button("Accept invitation", opts.link),
      p(`This link expires in ${opts.days} days and can only be used once. If you weren't expecting this invitation, you can ignore this email.`),
    ].join(""),
    footnote: `${siteConfig.name} will never ask for your password by email or phone.`,
  });
  const text = `${greet(opts.name)}\n\n${opts.inviterName} has invited you to the ${siteConfig.name} admin dashboard. Set your password here (expires in ${opts.days} days):\n${opts.link}\n\nIf you weren't expecting this, ignore this email.`;
  return { subject, html, text };
}

type Audience = "admin" | "applicant";
const ACCOUNT_LABEL: Record<Audience, string> = { admin: "admin account", applicant: "applicant portal account" };

export function passwordResetEmail(opts: { name: string; link: string; minutes: number; audience: Audience }): EmailContent {
  const subject = `Reset your ${siteConfig.name} password`;
  const html = renderLayout({
    preheader: "Use this link to choose a new password.",
    heading: "Reset your password",
    body: [
      p(escapeHtml(greet(opts.name))),
      p(`We received a request to reset the password for your ${ACCOUNT_LABEL[opts.audience]}.`),
      button("Choose a new password", opts.link),
      p(`This link expires in ${opts.minutes} minutes and can only be used once. If you didn't ask to reset your password, you can ignore this email. Your password won't change.`),
    ].join(""),
    footnote: `${siteConfig.name} will never ask for your password by email or phone.`,
  });
  const text = `${greet(opts.name)}\n\nReset the password for your ${siteConfig.name} ${ACCOUNT_LABEL[opts.audience]} (link expires in ${opts.minutes} minutes):\n${opts.link}\n\nIf you didn't request this, ignore this email.`;
  return { subject, html, text };
}

export function passwordChangedEmail(opts: { name: string; resetUrl: string; audience: Audience }): EmailContent {
  const escalate = opts.audience === "admin" ? "contact your super administrator" : `contact us at ${siteConfig.supportEmail}`;
  const subject = `Your ${siteConfig.name} password was changed`;
  const html = renderLayout({
    preheader: "Your password was just changed.",
    heading: "Your password was changed",
    body: [
      p(escapeHtml(greet(opts.name))),
      p(`The password for your ${ACCOUNT_LABEL[opts.audience]} was just changed, and you were signed out of other devices.`),
      p(`If this wasn't you, reset your password immediately and ${escapeHtml(escalate)}.`),
      button("Reset password", opts.resetUrl),
    ].join(""),
    footnote: `${siteConfig.name} will never ask for your password by email or phone.`,
  });
  const text = `${greet(opts.name)}\n\nThe password for your ${siteConfig.name} ${ACCOUNT_LABEL[opts.audience]} was just changed. If this wasn't you, reset it now (${opts.resetUrl}) and ${escalate}.`;
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
      p(`<strong>For your security:</strong> never send bank details by email. We will only ever collect them in the portal after you sign in with your password.`),
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

// --- Loans ------------------------------------------------------------------------

function instructionsBlock(instructions: string): string {
  if (!instructions.trim()) return "";
  return p("<strong>How to pay</strong>") + paragraphs(instructions);
}

export function loanApprovedEmail(opts: {
  firstName: string;
  reference: string;
  amount: string;
  totalRepayable: string;
  installment: string;
  installmentCount: number;
  frequencyLabel: string;
  firstDueDate: string;
  rateLabel: string;
  message?: string;
  instructions: string;
  portalUrl: string;
}): EmailContent {
  const subject = `Your ${siteConfig.name} loan has been approved`;
  const html = renderLayout({
    preheader: `Your loan of ${opts.amount} has been approved. First payment due ${opts.firstDueDate}.`,
    heading: "Your loan has been approved",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`Good news. Your loan for application <strong>${escapeHtml(opts.reference)}</strong> has been approved on the terms below.`),
      detailRows([
        ["Approved amount", opts.amount],
        ["Interest", opts.rateLabel],
        ["Total to repay", opts.totalRepayable],
        ["Repayments", `${opts.installmentCount} × ${opts.installment} (${opts.frequencyLabel.toLowerCase()})`],
        ["First payment due", opts.firstDueDate],
      ]),
      opts.message ? paragraphs(opts.message) : "",
      instructionsBlock(opts.instructions),
      p("Your full repayment schedule is in your applicant portal. We'll email you a reminder before each payment is due."),
      button("View your loan", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nYour loan for application ${opts.reference} has been approved.\n\nApproved amount: ${opts.amount}\nInterest: ${opts.rateLabel}\nTotal to repay: ${opts.totalRepayable}\nRepayments: ${opts.installmentCount} x ${opts.installment} (${opts.frequencyLabel.toLowerCase()})\nFirst payment due: ${opts.firstDueDate}\n\n${opts.message ? `${opts.message}\n\n` : ""}${opts.instructions ? `How to pay:\n${opts.instructions}\n\n` : ""}View your schedule: ${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function paymentReminderEmail(opts: {
  firstName: string;
  reference: string;
  kind: "UPCOMING" | "DUE_TODAY" | "OVERDUE_1" | "OVERDUE_7";
  amount: string;
  dueDate: string;
  outstanding: string;
  instructions: string;
  portalUrl: string;
}): EmailContent {
  const copy = {
    UPCOMING: { subject: `Payment reminder: ${opts.amount} due ${opts.dueDate}`, heading: "Your next payment is coming up", lead: `A payment of <strong>${escapeHtml(opts.amount)}</strong> is due on <strong>${escapeHtml(opts.dueDate)}</strong>.` },
    DUE_TODAY: { subject: `Your loan payment of ${opts.amount} is due today`, heading: "Your payment is due today", lead: `A payment of <strong>${escapeHtml(opts.amount)}</strong> is due today.` },
    OVERDUE_1: { subject: `Your loan payment is overdue`, heading: "Your payment is overdue", lead: `Your payment of <strong>${escapeHtml(opts.amount)}</strong> was due on <strong>${escapeHtml(opts.dueDate)}</strong> and hasn't been received yet.` },
    OVERDUE_7: { subject: `Action needed: your loan payment is 7 days overdue`, heading: "Your payment is 7 days overdue", lead: `Your payment of <strong>${escapeHtml(opts.amount)}</strong> was due on <strong>${escapeHtml(opts.dueDate)}</strong>. Please pay as soon as possible or contact us if you're having difficulty.` },
  }[opts.kind];
  const html = renderLayout({
    preheader: copy.subject,
    heading: copy.heading,
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(copy.lead),
      detailRows([
        ["Loan", opts.reference],
        ["Amount due", opts.amount],
        ["Due date", opts.dueDate],
        ["Total outstanding", opts.outstanding],
      ]),
      instructionsBlock(opts.instructions),
      p(`If you've already paid, thank you. It can take a little time for payments to be recorded.`),
      button("View your loan", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\n${copy.lead.replace(/<[^>]+>/g, "")}\n\nLoan: ${opts.reference}\nAmount due: ${opts.amount}\nDue date: ${opts.dueDate}\nTotal outstanding: ${opts.outstanding}\n\n${opts.instructions ? `How to pay:\n${opts.instructions}\n\n` : ""}${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject: copy.subject, html, text };
}

export function paymentReceivedEmail(opts: { firstName: string; reference: string; amount: string; paidOn: string; outstanding: string; nextDue: string | null; portalUrl: string }): EmailContent {
  const subject = `Payment received: ${opts.amount}`;
  const html = renderLayout({
    preheader: `Thank you. We've recorded your payment of ${opts.amount}.`,
    heading: "Payment received",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`Thank you. We've recorded your payment towards loan <strong>${escapeHtml(opts.reference)}</strong>.`),
      detailRows([
        ["Amount", opts.amount],
        ["Paid on", opts.paidOn],
        ["Remaining balance", opts.outstanding],
        ...(opts.nextDue ? ([["Next payment", opts.nextDue]] as Array<[string, string]>) : []),
      ]),
      button("View your loan", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nWe've recorded your payment of ${opts.amount} (paid ${opts.paidOn}) towards loan ${opts.reference}.\nRemaining balance: ${opts.outstanding}${opts.nextDue ? `\nNext payment: ${opts.nextDue}` : ""}\n\n${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function loanPaidOffEmail(opts: { firstName: string; reference: string; totalPaid: string; portalUrl: string }): EmailContent {
  const subject = `Your ${siteConfig.name} loan is fully repaid`;
  const html = renderLayout({
    preheader: "Congratulations, your loan is fully repaid.",
    heading: "Your loan is fully repaid",
    body: [
      p(escapeHtml(greet(opts.firstName))),
      p(`Congratulations. Loan <strong>${escapeHtml(opts.reference)}</strong> has been repaid in full. Total paid: <strong>${escapeHtml(opts.totalPaid)}</strong>.`),
      p("Thank you for choosing Loan Central."),
      button("View your account", opts.portalUrl),
      signOff(),
    ].join(""),
  });
  const text = `${greet(opts.firstName)}\n\nLoan ${opts.reference} has been repaid in full. Total paid: ${opts.totalPaid}.\n\nThank you for choosing Loan Central.\n${opts.portalUrl}\n\n${SIGN_OFF}`;
  return { subject, html, text };
}

export function testEmail(opts: { provider: string; adminName: string }): EmailContent {
  const subject = `${siteConfig.name} test email (${opts.provider})`;
  const html = renderLayout({
    preheader: "Your email settings are working.",
    heading: "Your email settings are working",
    body: p(`This test was sent through <strong>${escapeHtml(opts.provider)}</strong> at the request of ${escapeHtml(opts.adminName)}.`),
    footnote: "Internal test message.",
  });
  return { subject, html, text: `This test was sent through ${opts.provider} at the request of ${opts.adminName}.` };
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
