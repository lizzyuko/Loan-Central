"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { List, X } from "@phosphor-icons/react";
import { LinkButton } from "@/components/ui/Button";
import styles from "./MobileNav.module.css";

export function MobileNav({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Close on navigation (derived during render rather than in an effect).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} /> : <List size={22} />}
      </button>
      <div id={panelId} className={styles.panel} data-open={open || undefined} hidden={!open}>
        <nav aria-label="Mobile">
          <ul className={styles.list}>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={styles.link} onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/portal/login" className={styles.link} onClick={() => setOpen(false)}>
                Track application
              </Link>
            </li>
          </ul>
        </nav>
        <LinkButton href="/apply" size="lg" fullWidth onClick={() => setOpen(false)}>
          Check your options
        </LinkButton>
      </div>
    </div>
  );
}
