"use client";

import { useEffect, useRef } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { LinkButton } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import styles from "./SubmissionSuccess.module.css";

export function SubmissionSuccess({ reference, email }: { reference: string; email: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className={`container-narrow ${styles.wrap}`}>
      <div className={styles.card}>
        <span className={styles.icon} aria-hidden="true">
          <CheckCircle size={40} weight="fill" />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          Application submitted
        </h1>
        <p className={styles.lead}>
          Thank you. We&apos;ve received your application and sent a confirmation to <strong>{email}</strong>.
        </p>
        <div className={styles.reference}>
          <span>Your reference</span>
          <strong className={styles.refValue}>{reference}</strong>
        </div>

        <ol className={styles.next}>
          <li>
            <strong>We review your application.</strong> A member of our team will look at your details and documents, usually within{" "}
            {siteConfig.typicalReviewTime}.
          </li>
          <li>
            <strong>We email you an update.</strong> If we need anything else, we&apos;ll tell you exactly what.
          </li>
          <li>
            <strong>Track progress any time.</strong> You&apos;re signed in now. Next time, sign in to the applicant portal with your email and password.
          </li>
        </ol>

        <p className={styles.note}>
          Submitting an application does not guarantee approval or a loan offer. We will never ask for your bank details or a
          password by phone or email.
        </p>

        <div className={styles.actions}>
          <LinkButton href="/portal">Go to applicant portal</LinkButton>
          <LinkButton href="/" variant="secondary">
            Back to home
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
