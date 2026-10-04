import Link from "next/link";
import { ArrowRight, Briefcase, Car, GraduationCap, User, Wallet } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { formatMoney } from "@/config/currencies";
import type { PublicLoanProduct } from "@/lib/products/queries";
import section from "./section.module.css";
import styles from "./LoanProducts.module.css";

const ICONS: Record<string, ReactNode> = {
  personal: <User size={22} />,
  business: <Briefcase size={22} />,
  education: <GraduationCap size={22} />,
  auto: <Car size={22} />,
};

function termRange(terms: number[]): string | null {
  if (terms.length === 0) return null;
  const min = Math.min(...terms);
  const max = Math.max(...terms);
  return min === max ? `${min} months` : `${min} to ${max} months`;
}

export function LoanProducts({ products }: { products: PublicLoanProduct[] }) {
  return (
    <section id="loan-options" className={section.section} aria-labelledby="products-title">
      <div className="container">
        <div className={section.header}>
          <h2 id="products-title" className={section.heading}>
            Loan options we review
          </h2>
          <p className={section.intro}>
            Indicative ranges are shown for guidance. Availability, amounts and terms depend on your country and circumstances.
          </p>
        </div>

        {products.length === 0 ? (
          <div className={styles.empty}>
            <p>Loan options are being updated. You can still start an application and our team will review it.</p>
            <Link href="/apply" className={styles.cardLink}>
              Start an application <ArrowRight size={16} weight="bold" />
            </Link>
          </div>
        ) : (
          <ul className={styles.grid}>
            {products.map((p) => {
              const terms = termRange(p.termOptionsMonths);
              return (
                <li key={p.id} className={styles.card}>
                  <span className={styles.icon} aria-hidden="true">
                    {ICONS[p.purposeKey] ?? <Wallet size={22} />}
                  </span>
                  <h3 className={styles.name}>{p.name}</h3>
                  <p className={styles.description}>{p.shortDescription}</p>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Indicative amount</dt>
                      <dd className="tabular">
                        {formatMoney(p.minAmount, p.baseCurrency, "en", { compact: true })} to{" "}
                        {formatMoney(p.maxAmount, p.baseCurrency, "en", { compact: true })}
                      </dd>
                    </div>
                    {terms && (
                      <div>
                        <dt>Terms</dt>
                        <dd>{terms}</dd>
                      </div>
                    )}
                  </dl>
                  <Link href={`/apply?product=${encodeURIComponent(p.slug)}`} className={styles.cardLink}>
                    Apply for {p.name.toLowerCase()} <ArrowRight size={16} weight="bold" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
