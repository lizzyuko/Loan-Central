import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Applicant portal", template: "%s | Loan Central" },
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
