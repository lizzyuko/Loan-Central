import { ArrowRight } from "@phosphor-icons/react/ssr";
import { LinkButton } from "@/components/ui/Button";
import styles from "./FinalCta.module.css";

export function FinalCta() {
  return (
    <section className={styles.section} aria-labelledby="cta-title">
      <div className="container">
        <div className={styles.band}>
          <h2 id="cta-title" className={styles.heading}>
            Ready to see what may be available?
          </h2>
          <p className={styles.text}>Applying takes about 10 minutes and doesn&apos;t commit you to anything.</p>
          <LinkButton href="/apply" size="lg" iconRight={<ArrowRight size={18} weight="bold" />}>
            Check your options
          </LinkButton>
          <p className={styles.note}>Submitting an application does not guarantee approval or a loan offer.</p>
        </div>
      </div>
    </section>
  );
}
