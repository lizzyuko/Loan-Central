import { ArrowRight, EnvelopeSimple } from "@phosphor-icons/react/ssr";
import { LinkButton } from "@/components/ui/Button";
import { ProgressTracker } from "@/components/portal/ProgressTracker";
import { APPLICANT_STATUS_COPY } from "@/lib/application/status";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <h1 id="hero-title" className={styles.title}>
            Find loan options that fit your needs.
          </h1>
          <p className={styles.lead}>
            Tell us what you need. Our team reviews every application personally and lets you know your options.
          </p>
          <div className={styles.ctas}>
            <LinkButton href="/apply" size="lg" iconRight={<ArrowRight size={18} weight="bold" />}>
              Check your options
            </LinkButton>
            <LinkButton href="#how-it-works" size="lg" variant="secondary">
              How it works
            </LinkButton>
          </div>
        </div>

        {/* A real portal component rendered with example data. */}
        <figure className={styles.preview} aria-label="Example of the applicant portal">
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.panelLabel}>Application</p>
                <p className={styles.reference}>LC-2026-104829</p>
              </div>
              <span className={styles.example}>Example</span>
            </div>
            <ProgressTracker status="ACCOUNT_DETAILS_REQUESTED" />
            <div className={styles.message}>
              <span className={styles.messageIcon} aria-hidden="true">
                <EnvelopeSimple size={18} />
              </span>
              <div>
                <p className={styles.messageFrom}>Loan Central review team</p>
                <p className={styles.messageText}>{APPLICANT_STATUS_COPY.ACCOUNT_DETAILS_REQUESTED}</p>
              </div>
            </div>
          </div>
          <figcaption className="visually-hidden">
            The applicant portal shows where your application is in the review process.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
