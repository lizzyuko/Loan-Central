"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./Wizard.module.css";

/**
 * The wizard restores progress from sessionStorage on first render, so it is
 * rendered on the client only (avoids hydration mismatches).
 */
export const ApplicationWizard = dynamic(() => import("./ApplicationWizard").then((m) => m.ApplicationWizard), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <Spinner label="Loading your application" />
    </div>
  ),
});
