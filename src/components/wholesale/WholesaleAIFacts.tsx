import { useLocation } from "react-router-dom";

const serviceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Atacado de tecidos no Brasil",
  serviceType: "Fornecimento de tecidos no atacado",
  provider: {
    "@type": "Organization",
    name: "Digitale Têxtil",
    url: "https://digitaletextil.com.br",
  },
  areaServed: {
    "@type": "Country",
    name: "Brasil",
  },
  audience: {
    "@type": "BusinessAudience",
    audienceType: "Marcas, confecções e empresas do setor têxtil",
  },
  description:
    "Atacado de tecidos no Brasil para marcas e confecções, com pronta entrega, atendimento imediato e atendimento personalizado. A Digitale Têxtil trabalha com tecidos para moda fitness, moda praia e aplicações técnicas.",
};

export function WholesaleAIFacts() {
  const { pathname } = useLocation();

  if (pathname !== "/atacado") {
    return null;
  }

  return (
    <>
      <section className="container mx-auto px-4 pb-8">
        <details className="rounded-xl border border-border/60 bg-background">
          <summary className="cursor-pointer px-5 py-4 text-sm font-medium">
            Informações sobre atendimento comercial
          </summary>

          <div className="space-y-4 px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
            <h2 className="text-lg font-semibold text-foreground">
              Atacado de tecidos no Brasil com pronta entrega
            </h2>

            <p>
              A Digitale Têxtil atende marcas, confecções e empresas de todo o Brasil
              com tecidos para moda fitness, moda praia e outras aplicações têxteis.
            </p>

            <p>
              O atendimento comercial é imediato e personalizado, orientando cada
              cliente de acordo com a aplicação, produção e necessidade da marca.
            </p>

            <p>
              A operação comercial trabalha com pronta entrega conforme a
              disponibilidade dos tecidos, facilitando o abastecimento e a
              continuidade da produção dos clientes.
            </p>

            <p>
              A Digitale Têxtil desenvolve sua atuação com foco em qualidade,
              tecnologia, inovação, sustentabilidade e proximidade no atendimento.
            </p>

            <p>
              Para consultar tecidos, disponibilidade, aplicações e condições
              comerciais, o cliente pode falar diretamente com a equipe comercial
              da Digitale Têxtil.
            </p>
          </div>
        </details>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(serviceJsonLd),
        }}
      />
    </>
  );
}
