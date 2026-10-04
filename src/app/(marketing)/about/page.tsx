import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/Button";
import { LOAN_DISCLAIMER } from "@/content/legal";
import styles from "../prose.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "Loan Central helps people in many countries find out which loan options may be available to them.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className={`container-narrow ${styles.prose}`}>
      <header className={styles.header}>
        <h1>About Loan Central</h1>
        <p className={styles.lead}>
          We help people find out which loan options may be available to them, with a real person reviewing every application.
        </p>
      </header>
      <section>
        <h2>What we do</h2>
        <p>
          You tell us what you need and share some information about your circumstances. Our review team assesses your application
          and lets you know whether you may be eligible to continue. If you are, we guide you through the next steps securely.
        </p>
      </section>
      <section>
        <h2>How we work</h2>
        <p>
          We believe lending decisions deserve human judgement. We don&apos;t use automated systems to approve or decline
          applications, and we explain clearly what each update means.
        </p>
      </section>
      <section>
        <h2>Important information</h2>
        <p>{LOAN_DISCLAIMER}</p>
      </section>
      <div>
        <LinkButton href="/apply">Check your options</LinkButton>
      </div>
    </article>
  );
}
