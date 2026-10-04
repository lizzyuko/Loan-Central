import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_DOCUMENTS, type LegalSlug } from "@/content/legal";
import styles from "../../prose.module.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(LEGAL_DOCUMENTS).map((slug) => ({ slug }));
}

function getDoc(slug: string) {
  return LEGAL_DOCUMENTS[slug as LegalSlug];
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  if (!doc) return {};
  return { title: doc.title, description: doc.description, alternates: { canonical: `/legal/${doc.slug}` } };
}

export default async function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  const doc = getDoc((await params).slug);
  if (!doc) notFound();

  return (
    <article className={`container-narrow ${styles.prose}`}>
      <header className={styles.header}>
        <h1>{doc.title}</h1>
        <p className={styles.meta}>Last updated {doc.updated}</p>
      </header>
      {doc.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
