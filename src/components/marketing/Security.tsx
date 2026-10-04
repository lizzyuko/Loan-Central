import { FileLock, Fingerprint, Password, Robot, ShieldCheck } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import styles from "./Security.module.css";

const POINTS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Secure application",
    body: "Your application is sent over an encrypted connection and every submission is validated on our servers.",
    icon: <ShieldCheck size={22} />,
  },
  {
    title: "Protected document handling",
    body: "Uploaded documents are stored privately. Only authorised reviewers can open them, through short-lived links, and every view is logged.",
    icon: <FileLock size={22} />,
  },
  {
    title: "Protected accounts",
    body: "Passwords are stored only as strong one-way hashes. Repeated wrong attempts lock the account, and reset links expire within minutes.",
    icon: <Password size={22} />,
  },
  {
    title: "Privacy-conscious design",
    body: "We collect only what the review needs. Bank details are requested only if you progress, encrypted, and never sent by email.",
    icon: <Fingerprint size={22} />,
  },
  {
    title: "Anti-bot protection",
    body: "Forms are protected by Cloudflare Turnstile and rate limits, which keeps automated abuse out of the review queue.",
    icon: <Robot size={22} />,
  },
];

export function Security() {
  return (
    <section id="security" className={styles.section} aria-labelledby="security-title">
      <div className="container">
        <div className={styles.panel}>
          <div className={styles.intro}>
            <h2 id="security-title" className={styles.heading}>
              How we look after your information
            </h2>
            <p className={styles.lead}>
              Applying for a loan means sharing personal details. Here is what we do to keep them safe.
            </p>
          </div>
          <ul className={styles.points}>
            {POINTS.map((p) => (
              <li key={p.title} className={styles.point}>
                <span className={styles.icon} aria-hidden="true">
                  {p.icon}
                </span>
                <div>
                  <h3 className={styles.title}>{p.title}</h3>
                  <p className={styles.body}>{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
