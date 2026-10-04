import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import styles from "../prose.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to contact the Loan Central team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <article className={`container-narrow ${styles.prose}`}>
      <header className={styles.header}>
        <h1>Contact us</h1>
        <p className={styles.lead}>We&apos;re here to help with questions about applying or about an application in progress.</p>
      </header>
      <section>
        <h2>Already applied?</h2>
        <p>
          The quickest way to reach your reviewer is through your <Link href="/portal/login">applicant portal</Link>. Messages there
          are attached to your application, so we have the full context.
        </p>
      </section>
      <section>
        <h2>General questions</h2>
        <p>
          Email <a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>. Please don&apos;t send identity
          documents or bank details by email. We will never ask you to.
        </p>
      </section>
    </article>
  );
}
