import type { Metadata } from "next";
import { ApplicationWizard } from "@/components/application/wizard/ClientWizard";
import { Alert } from "@/components/ui/Feedback";
import { DEFAULT_DOCUMENT_TYPES } from "@/config/documents";
import { getActiveDocumentTypes, getActiveProducts } from "@/lib/products/queries";
import { submitApplicationAction } from "./actions";

export const metadata: Metadata = {
  title: "Apply",
  description: "Start your Loan Central application. It takes around 10 minutes. Submitting an application does not guarantee approval.",
  alternates: { canonical: "/apply" },
};

// Reads live product configuration on each request.
export const dynamic = "force-dynamic";

export default async function ApplyPage({ searchParams }: PageProps<"/apply">) {
  const [products, docTypes, params] = await Promise.all([getActiveProducts(), getActiveDocumentTypes(), searchParams]);
  const documentTypes = docTypes.length > 0 ? docTypes : DEFAULT_DOCUMENT_TYPES.map((d) => ({ ...d }));
  const productParam = typeof params.product === "string" ? params.product : undefined;
  const initialProductSlug = products.some((p) => p.slug === productParam) ? productParam : undefined;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <>
      {!siteKey && (
        <div className="container" style={{ paddingTop: "var(--space-6)" }}>
          <Alert tone="warning" title="Applications are temporarily unavailable">
            The security check isn&apos;t configured. Please try again later.
          </Alert>
        </div>
      )}
      <ApplicationWizard
        products={products.map((p) => ({
          slug: p.slug,
          name: p.name,
          shortDescription: p.shortDescription,
          purposeKey: p.purposeKey,
          minAmount: p.minAmount,
          maxAmount: p.maxAmount,
          baseCurrency: p.baseCurrency,
          supportedCurrencies: p.supportedCurrencies,
          termOptionsMonths: p.termOptionsMonths,
          requiredDocumentTypes: p.requiredDocumentTypes,
        }))}
        documentTypes={documentTypes}
        initialProductSlug={initialProductSlug}
        turnstileSiteKey={siteKey}
        submit={submitApplicationAction}
      />
    </>
  );
}
