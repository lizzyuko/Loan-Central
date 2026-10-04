import Link from "next/link";
import { Plus } from "@phosphor-icons/react/ssr";
import { FAQ_ITEMS } from "@/content/faq";
import section from "./section.module.css";
import styles from "./Faq.module.css";

export function Faq() {
  return (
    <section id="faq" className={section.section} aria-labelledby="faq-title">
      <div className={`container ${styles.grid}`}>
        <div className={styles.side}>
          <h2 id="faq-title" className={section.heading}>
            Questions, answered
          </h2>
          <p className={styles.sideText}>
            Can&apos;t find what you need? <Link href="/contact">Contact our team</Link>.
          </p>
        </div>
        <div className={styles.list}>
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className={styles.item} name="faq">
              <summary className={styles.summary}>
                <span>{item.question}</span>
                <Plus size={18} className={styles.chevron} aria-hidden="true" />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
