import { ArrowCircleRight, ClipboardText, EnvelopeOpen, UserFocus } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import section from "./section.module.css";
import styles from "./HowItWorks.module.css";

const STEPS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Apply",
    body: "Tell us about the loan you need, your income and commitments. It takes around 10 minutes.",
    icon: <ClipboardText size={22} />,
  },
  {
    title: "We review",
    body: "A member of our team reviews your application and documents. No automated decisions.",
    icon: <UserFocus size={22} />,
  },
  {
    title: "Receive an eligibility update",
    body: `We email you within ${siteConfig.typicalReviewTime}, or sooner if we need anything else.`,
    icon: <EnvelopeOpen size={22} />,
  },
  {
    title: "Continue if eligible",
    body: "If you may be eligible, we invite you to complete the next steps in your secure portal.",
    icon: <ArrowCircleRight size={22} />,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className={section.section} aria-labelledby="how-title">
      <div className="container">
        <div className={section.header}>
          <h2 id="how-title" className={section.heading}>
            How it works
          </h2>
          <p className={section.intro}>
            A straightforward process with a person reviewing every application, and clear updates at each stage.
          </p>
        </div>
        <ol className={styles.steps}>
          {STEPS.map((step) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.icon} aria-hidden="true">
                {step.icon}
              </span>
              <h3 className={styles.title}>{step.title}</h3>
              <p className={styles.body}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
