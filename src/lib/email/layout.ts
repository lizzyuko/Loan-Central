import { siteConfig } from "@/config/site";

/**
 * Minimal, table-based, inline-styled email layout. Works across major
 * clients (Gmail, Outlook, Apple Mail) and in dark mode. Every dynamic value
 * MUST pass through escapeHtml.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const C = {
  bg: "#f6f7f5",
  card: "#ffffff",
  border: "#e1e5e0",
  text: "#0f1b24",
  muted: "#5f6b76",
  primary: "#0c5a4b",
  soft: "#e3efeb",
};

/** Plain text → escaped HTML paragraphs. */
export function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.text};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${C.text};">${html}</p>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:10px;background:${C.primary};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

export function codeBlock(code: string): string {
  return `<div style="margin:8px 0 24px;padding:18px;background:${C.soft};border-radius:12px;text-align:center;">
<span style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${C.text};">${escapeHtml(code)}</span>
</div>`;
}

export function detailRows(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([k, v]) => `<tr>
<td style="padding:8px 0;font-size:14px;color:${C.muted};width:42%;">${escapeHtml(k)}</td>
<td style="padding:8px 0;font-size:14px;color:${C.text};font-weight:600;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};">${body}</table>`;
}

export function list(items: string[]): string {
  return `<ul style="margin:0 0 20px;padding-left:20px;">${items
    .map((i) => `<li style="margin:0 0 6px;font-size:15px;line-height:22px;color:${C.text};">${escapeHtml(i)}</li>`)
    .join("")}</ul>`;
}

interface LayoutOptions {
  preheader: string;
  heading: string;
  body: string;
  /** Optional smaller print under the card. */
  footnote?: string;
}

export function renderLayout({ preheader, heading, body, footnote }: LayoutOptions): string {
  const footer =
    footnote ??
    `Submitting an application does not guarantee approval or a loan offer. ${siteConfig.name} will never ask you for a password, verification code or bank details by email or phone.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:28px;height:28px;background:${C.primary};border-radius:8px;"></td>
<td style="padding-left:10px;font-size:17px;font-weight:600;color:${C.text};letter-spacing:-0.2px;">Loan Central</td>
</tr></table>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:32px 28px;">
<h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:600;color:${C.text};letter-spacing:-0.3px;">${escapeHtml(heading)}</h1>
${body}
</td></tr>
<tr><td style="padding:20px 8px 0;font-size:12px;line-height:18px;color:${C.muted};">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
