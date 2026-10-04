import { ChatCircleText, Globe, LockKey, Notepad, UsersThree } from "@phosphor-icons/react/ssr";
import { SUPPORTED_CURRENCIES } from "@/config/currencies";
import section from "./section.module.css";
import styles from "./WhyUs.module.css";

const SAMPLE_CURRENCIES = SUPPORTED_CURRENCIES.slice(0, 18);

export function WhyUs() {
  return (
    <section className={section.section} aria-labelledby="why-title">
      <div className="container">
        <div className={section.header}>
          <h2 id="why-title" className={section.heading}>
            Why apply with Loan Central
          </h2>
        </div>

        <div className={styles.bento}>
          <article className={`${styles.cell} ${styles.feature}`}>
            <UsersThree size={28} className={styles.icon} aria-hidden="true" />
            <h3 className={styles.title}>Reviewed by people, not just a formula</h3>
            <p className={styles.body}>
              Every application is read by a member of our team, who looks at your whole situation. If something is unclear, we ask
              rather than decline.
            </p>
          </article>

          <article className={styles.cell}>
            <Notepad size={24} className={styles.icon} aria-hidden="true" />
            <h3 className={styles.title}>A simple application</h3>
            <p className={styles.body}>One guided form, in plain language, that saves your progress as you go.</p>
          </article>

          <article className={`${styles.cell} ${styles.muted}`}>
            <ChatCircleText size={24} className={styles.icon} aria-hidden="true" />
            <h3 className={styles.title}>Clear communication</h3>
            <p className={styles.body}>You always know where your application stands, by email and in your portal.</p>
          </article>

          <article className={`${styles.cell} ${styles.wide}`}>
            <Globe size={24} className={styles.icon} aria-hidden="true" />
            <h3 className={styles.title}>Built for international applicants</h3>
            <p className={styles.body}>Apply from many countries, in the currency you earn and borrow in.</p>
            <ul className={styles.chips} aria-label="Examples of supported currencies">
              {SAMPLE_CURRENCIES.map((c) => (
                <li key={c} className={styles.chip}>
                  {c}
                </li>
              ))}
            </ul>
          </article>

          <article className={`${styles.cell} ${styles.secure}`}>
            <LockKey size={24} className={styles.icon} aria-hidden="true" />
            <h3 className={styles.title}>Careful with your information</h3>
            <p className={styles.body}>We only ask for what the review needs, and bank details only if you progress.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
