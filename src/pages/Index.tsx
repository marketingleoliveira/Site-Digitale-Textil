import { lazy, Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/SEO";
import { JsonLd, ORGANIZATION_JSONLD } from "@/components/JsonLd";
import { Hero } from "@/components/sections/Hero";
import { Products } from "@/components/sections/Products";
import { Testimonials } from "@/components/sections/Testimonials";
import { Clients } from "@/components/sections/Clients";

const LazySustainability = lazy(() =>
  import("@/components/sections/Sustainability").then((module) => ({
    default: module.Sustainability,
  })),
);

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <SEO title="Tecidos Fitness e Malhas Técnicas com Proteção UV 50+" description="Fábrica de tecidos fitness, moda praia e malhas técnicas com proteção UV 50+, Aloe Vera e antibacteriano. Linha ECO sustentável e estampas exclusivas direto da fábrica." keywords="tecido fitness, malha fitness, tecido moda praia, tecido com proteção UV, tecido aloe vera, tecido antibacteriano, fábrica de tecidos São Paulo, tecidos sustentáveis, malha sportwear, tecido para academia, fornecedor de tecidos, Digitale Têxtil" />
      <JsonLd id="organization" data={ORGANIZATION_JSONLD} />
      <JsonLd
        id="website"
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Digitale Têxtil",
          url: "https://digitaletextil.com.br",
          inLanguage: "pt-BR",
        }}
      />
      <main>
        <Hero />
        <Testimonials />
        <Products />

        {/* DIGITALE_CTA_TECIDOS_ANTES_DEPOIMENTOS */}
        <div className="flex justify-center bg-secondary/30 px-4 pb-12 pt-2">
          <a
            href="https://digitaletextil.com.br/tecidos"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FF7900] px-8 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#E66D00] hover:shadow-lg active:scale-95"
          >
            Ver mais tecidos
            <span aria-hidden="true">→</span>
          </a>
        </div>

        
        <Suspense fallback={null}>
          <LazySustainability />
        </Suspense>
        <Clients />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
