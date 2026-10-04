import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/forms/PasswordAuthForms";
import { requireApplicantPage } from "@/lib/auth/applicant";
import { changeApplicantPassword } from "../../(auth)/actions";
import styles from "../portal.module.css";

export const metadata: Metadata = { title: "Your account" };

export default async function PortalAccountPage() {
  const applicant = await requireApplicantPage();
  return (
    <>
      <div>
        <h1 className={styles.title}>Your account</h1>
        <p className={styles.subtitle}>{applicant.email}</p>
      </div>
      <section className={styles.card} aria-labelledby="pw-title">
        <h2 id="pw-title" className={styles.cardTitle}>
          Change password
        </h2>
        <ChangePasswordForm email={applicant.email} submit={changeApplicantPassword} />
      </section>
    </>
  );
}
