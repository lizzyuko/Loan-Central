import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { LoanProducts } from "@/components/marketing/LoanProducts";
import { WhyUs } from "@/components/marketing/WhyUs";
import { Security } from "@/components/marketing/Security";
import { Faq } from "@/components/marketing/Faq";
import { FinalCta } from "@/components/marketing/FinalCta";
import { FAQ_ITEMS } from "@/content/faq";
import { getActiveProducts } from "@/lib/products/queries";

// Products are database-driven; refresh the static page every 5 minutes.
export const revalidate = 300;

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

export default async function HomePage() {
  const products = await getActiveProducts();
  return (
    <>
      <Hero />
      <HowItWorks />
      <LoanProducts products={products} />
      <WhyUs />
      <Security />
      <Faq />
      <FinalCta />
      <script
        type="application/ld+json"
        // Static, server-generated content (no user input).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
