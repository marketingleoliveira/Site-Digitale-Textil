import { WholesaleFabricLinks } from "@/components/wholesale/WholesaleFabricLinks";
import { WholesaleAIFacts } from "@/components/wholesale/WholesaleAIFacts";
import {
  useEffect
} from "react";

import {
  Link,
  useLocation
} from "react-router-dom";

import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import {
  Header
} from "@/components/layout/Header";

import {
  Footer
} from "@/components/layout/Footer";

import {
  SEO
} from "@/components/SEO";

import {
  Button
} from "@/components/ui/button";

import {
  useSiteSettings
} from "@/hooks/useSiteSettings";

import {
  trackWholesaleEvent
} from "@/lib/wholesale-tracking";


type LandingConfig = {

  key:
    string;

  canonical:
    string;

  title:
    string;

  description:
    string;

  keywords:
    string;

  eyebrow:
    string;

  heading:
    string;

  intro:
    string;

  body:
    string;

  searchTerms:
    string[];

  applications:
    string[];

  points:
    string[];
};


const configs:
Record<string, LandingConfig> = {

  "/atacado": {

    key:
      "atacado",

    canonical:
      "https://digitaletextil.com.br/atacado",

    title:
      "Tecidos no Atacado | Digitale Têxtil",

    description:
      "Encontre tecidos para compras no atacado na Digitale Têxtil. Soluções para marcas, confecções, fitness e moda praia com atendimento comercial especializado.",

    keywords:
      "tecidos no atacado, tecido atacado, fornecedor de tecidos, fábrica de tecidos, tecidos para confecção, fornecedor têxtil, Digitale Têxtil",

    eyebrow:
      "DIGITALE PARA EMPRESAS",

    heading:
      "Tecidos no atacado para marcas e confecções",

    intro:
      "Encontre tecidos técnicos para desenvolver coleções fitness, moda praia e outros projetos de confecção.",

    body:
      "A Digitale Têxtil atende empresas que procuram variedade, tecnologia e suporte comercial para escolher o tecido mais adequado para cada projeto.",

    searchTerms: [
      "Tecidos no atacado",
      "Fornecedor de tecidos",
      "Tecidos para confecção",
      "Tecidos para marcas"
    ],

    applications: [
      "Moda fitness",
      "Moda praia",
      "Confecções",
      "Marcas autorais"
    ],

    points: [
      "Atendimento comercial para compras em atacado",
      "Variedade de tecidos técnicos",
      "Opções para fitness e moda praia",
      "Suporte para escolha do artigo adequado"
    ]
  },


  "/tecido-fitness-atacado": {

    key:
      "fitness_atacado",

    canonical:
      "https://digitaletextil.com.br/tecido-fitness-atacado",

    title:
      "Tecido Fitness no Atacado | Digitale Têxtil",

    description:
      "Tecidos fitness no atacado para leggings, tops, shorts e coleções esportivas. Conheça artigos e tecnologias da Digitale Têxtil para sua marca.",

    keywords:
      "tecido fitness atacado, tecido academia atacado, fornecedor tecido fitness, tecido para legging, tecido para roupa de academia, tecido esportivo atacado",

    eyebrow:
      "TECIDOS FITNESS",

    heading:
      "Tecido fitness no atacado para sua marca",

    intro:
      "Desenvolva leggings, tops, shorts, bermudas e outras peças esportivas com tecidos selecionados para o segmento fitness.",

    body:
      "Consulte nossa equipe para encontrar artigos adequados ao nível de elasticidade, cobertura, toque e acabamento que sua coleção precisa.",

    searchTerms: [
      "Tecido fitness atacado",
      "Tecido para academia",
      "Tecido para legging",
      "Fornecedor de tecido fitness"
    ],

    applications: [
      "Leggings",
      "Tops",
      "Shorts",
      "Bermudas fitness"
    ],

    points: [
      "Artigos voltados ao segmento esportivo",
      "Opções com diferentes estruturas e acabamentos",
      "Tecnologias disponíveis conforme o artigo",
      "Atendimento para marcas e confecções"
    ]
  },


  "/tecido-poliamida-atacado": {

    key:
      "poliamida_atacado",

    canonical:
      "https://digitaletextil.com.br/tecido-poliamida-atacado",

    title:
      "Tecido Poliamida no Atacado | Digitale Têxtil",

    description:
      "Poliamida no atacado para moda fitness e moda praia. Conheça tecidos da Digitale Têxtil e solicite atendimento comercial para sua confecção ou marca.",

    keywords:
      "poliamida atacado, tecido poliamida atacado, comprar tecido poliamida, fornecedor poliamida, poliamida fitness, poliamida moda praia",

    eyebrow:
      "POLIAMIDA NO ATACADO",

    heading:
      "Tecido de poliamida no atacado",

    intro:
      "Encontre opções em poliamida para desenvolver peças de moda fitness, esportiva e praia.",

    body:
      "Nossa equipe comercial pode orientar a escolha conforme aplicação, toque, elasticidade, estrutura e tecnologias disponíveis em cada artigo.",

    searchTerms: [
      "Poliamida atacado",
      "Tecido poliamida",
      "Fornecedor de poliamida",
      "Poliamida para fitness"
    ],

    applications: [
      "Fitness",
      "Activewear",
      "Moda praia",
      "Coleções técnicas"
    ],

    points: [
      "Opções de poliamida para diferentes aplicações",
      "Atendimento técnico-comercial",
      "Consulta de cores e artigos disponíveis",
      "Tecnologias variam conforme o tecido"
    ]
  },


  "/tecido-moda-praia-atacado": {

    key:
      "praia_atacado",

    canonical:
      "https://digitaletextil.com.br/tecido-moda-praia-atacado",

    title:
      "Tecido para Moda Praia no Atacado | Digitale Têxtil",

    description:
      "Tecidos para moda praia no atacado para biquínis, maiôs e beachwear. Conheça opções da Digitale Têxtil e fale com nossa equipe comercial.",

    keywords:
      "tecido moda praia atacado, tecido para biquíni atacado, tecido para maiô, fornecedor tecido moda praia, tecido beachwear, tecido com proteção UV",

    eyebrow:
      "MODA PRAIA",

    heading:
      "Tecidos para moda praia no atacado",

    intro:
      "Encontre tecidos para biquínis, maiôs e coleções beachwear com opções desenvolvidas para o segmento de moda praia.",

    body:
      "Consulte artigos, cores e tecnologias disponíveis para encontrar a solução mais adequada à proposta da sua coleção.",

    searchTerms: [
      "Tecido moda praia atacado",
      "Tecido para biquíni",
      "Tecido para maiô",
      "Fornecedor moda praia"
    ],

    applications: [
      "Biquínis",
      "Maiôs",
      "Beachwear",
      "Moda resort"
    ],

    points: [
      "Artigos para moda praia",
      "Opções para diferentes modelagens",
      "Tecnologias disponíveis conforme o artigo",
      "Atendimento para marcas e confecções"
    ]
  }
};


const technologies = [
  "Zero Transparência",
  "Proteção UV50+",
  "Aloe Vera",
  "4 Way Stretch",
  "Antibacteriano",
  "CREORA"
];


const faqs = [

  {
    question:
      "Como comprar tecidos no atacado?",

    answer:
      "Entre em contato com a equipe comercial da Digitale Têxtil. Informe o tipo de peça ou coleção que deseja produzir para receber orientação sobre os artigos disponíveis."
  },

  {
    question:
      "Qual é a quantidade mínima para comprar?",

    answer:
      "As condições comerciais podem variar conforme o tecido e o pedido. Consulte nossa equipe para receber as informações atualizadas."
  },

  {
    question:
      "Posso consultar cores disponíveis?",

    answer:
      "Sim. A equipe comercial pode informar as cores e artigos disponíveis no momento do atendimento."
  },

  {
    question:
      "A Digitale possui tecidos com tecnologias especiais?",

    answer:
      "A Digitale trabalha com diferentes tecnologias têxteis. A disponibilidade de cada tecnologia varia conforme o artigo escolhido."
  }
];


export default function WholesaleLanding() {

  const location =
    useLocation();

  const {
    whatsappNumber
  } =
    useSiteSettings();


  const config =
    configs[
      location.pathname
    ]
    ||
    configs["/atacado"];


  const phone =
    String(
      whatsappNumber
      || ""
    )
      .replace(
        /\D/g,
        ""
      );


  const quoteMessage =
    encodeURIComponent(
      `Olá! Vim pelo site da Digitale Têxtil e gostaria de solicitar informações para compra de tecidos no atacado. Tenho interesse em ${config.heading.toLowerCase()}.`
    );


  const sampleMessage =
    encodeURIComponent(
      `Olá! Vim pelo site da Digitale Têxtil e gostaria de consultar a possibilidade de amostra para ${config.heading.toLowerCase()}.`
    );


  const quoteUrl =
    phone
      ?
        `https://wa.me/${phone}?text=${quoteMessage}`
      :
        "/contato";


  const sampleUrl =
    phone
      ?
        `https://wa.me/${phone}?text=${sampleMessage}`
      :
        "/contato";


  useEffect(
    () => {

      trackWholesaleEvent(
        "wholesale_landing_view",
        {
          page:
            config.key,

          path:
            location.pathname
        }
      );


      const currentCanonical =
        document.querySelector<HTMLLinkElement>(
          'link[rel="canonical"]'
        );


      const createdCanonical =
        !currentCanonical;


      const canonical =
        currentCanonical
        ||
        document.createElement(
          "link"
        );


      const previousCanonical =
        canonical.getAttribute(
          "href"
        );


      canonical.setAttribute(
        "rel",
        "canonical"
      );

      canonical.setAttribute(
        "href",
        config.canonical
      );


      if (
        createdCanonical
      ) {

        document.head.appendChild(
          canonical
        );
      }


      const oldJsonLd =
        document.getElementById(
          "digitale-wholesale-jsonld"
        );


      oldJsonLd?.remove();


      const jsonLd =
        document.createElement(
          "script"
        );


      jsonLd.id =
        "digitale-wholesale-jsonld";

      jsonLd.type =
        "application/ld+json";


      jsonLd.text =
        JSON.stringify({

          "@context":
            "https://schema.org",

          "@graph": [

            {
              "@type":
                "WebPage",

              "@id":
                `${config.canonical}#webpage`,

              url:
                config.canonical,

              name:
                config.title,

              description:
                config.description,

              inLanguage:
                "pt-BR"
            },

            {
              "@type":
                "BreadcrumbList",

              itemListElement: [

                {
                  "@type":
                    "ListItem",

                  position:
                    1,

                  name:
                    "Início",

                  item:
                    "https://digitaletextil.com.br/"
                },

                {
                  "@type":
                    "ListItem",

                  position:
                    2,

                  name:
                    "Atacado",

                  item:
                    config.canonical
                }
              ]
            },

            {
              "@type":
                "FAQPage",

              mainEntity:
                faqs.map(
                  item => ({

                    "@type":
                      "Question",

                    name:
                      item.question,

                    acceptedAnswer: {

                      "@type":
                        "Answer",

                      text:
                        item.answer
                    }
                  })
                )
            }
          ]
        });


      document.head.appendChild(
        jsonLd
      );


      return () => {

        jsonLd.remove();


        if (
          createdCanonical
        ) {

          canonical.remove();

        } else if (
          previousCanonical
        ) {

          canonical.setAttribute(
            "href",
            previousCanonical
          );
        }
      };

    },

    [
      config,
      location.pathname
    ]
  );


  const clickQuote =
    () => {

      trackWholesaleEvent(
        "wholesale_quote_click",
        {
          page:
            config.key
        }
      );
    };


  const clickSample =
    () => {

      trackWholesaleEvent(
        "wholesale_sample_click",
        {
          page:
            config.key
        }
      );
    };


  return (
    <div
      className="
        min-h-screen
        bg-background
      "
    >

      <SEO
        title={
          config.title
        }
        description={
          config.description
        }
        keywords={
          config.keywords
        }
      />


      <Header />


      <main>

        <section
          className="
            relative
            overflow-hidden
            border-b
            bg-gradient-to-br
            from-primary
            via-primary
            to-primary/85
            pt-32
            pb-20
            md:pt-40
            md:pb-28
          "
        >

          <div
            className="
              absolute
              inset-0
              opacity-10
              pointer-events-none
            "
            aria-hidden="true"
          >

            <div
              className="
                absolute
                -right-32
                -top-32
                h-96
                w-96
                rounded-full
                bg-white
                blur-3xl
              "
            />

            <div
              className="
                absolute
                -bottom-40
                left-1/4
                h-80
                w-80
                rounded-full
                bg-accent
                blur-3xl
              "
            />

          </div>


          <div
            className="
              container
              relative
              mx-auto
              px-6
            "
          >

            <div
              className="
                max-w-4xl
              "
            >

              <p
                className="
                  mb-5
                  text-sm
                  font-bold
                  uppercase
                  tracking-[0.22em]
                  text-white/70
                "
              >
                {config.eyebrow}
              </p>


              <h1
                className="
                  max-w-4xl
                  text-4xl
                  font-bold
                  leading-tight
                  text-white
                  md:text-6xl
                "
              >
                {config.heading}
              </h1>


              <p
                className="
                  mt-6
                  max-w-3xl
                  text-lg
                  leading-relaxed
                  text-white/85
                  md:text-xl
                "
              >
                {config.intro}
              </p>


              <div
                className="
                  mt-9
                  flex
                  flex-col
                  gap-3
                  sm:flex-row
                "
              >

                <a
                  href={
                    quoteUrl
                  }
                  target={
                    phone
                      ?
                        "_blank"
                      :
                        undefined
                  }
                  rel={
                    phone
                      ?
                        "noopener noreferrer"
                      :
                        undefined
                  }
                  onClick={
                    clickQuote
                  }
                >

                  <Button
                    size="lg"
                    className="
                      w-full
                      bg-accent
                      text-accent-foreground
                      hover:bg-accent/90
                      sm:w-auto
                    "
                  >

                    Solicitar orçamento

                    <MessageCircle
                      className="
                        ml-2
                        h-5
                        w-5
                      "
                    />

                  </Button>

                </a>


                <Link
                  to="/tecidos"
                  onClick={
                    () =>
                      trackWholesaleEvent(
                        "wholesale_catalog_click",
                        {
                          page:
                            config.key
                        }
                      )
                  }
                >

                  <Button
                    size="lg"
                    variant="outline"
                    className="
                      w-full
                      border-white/30
                      bg-white/5
                      text-white
                      hover:bg-white/15
                      hover:text-white
                      sm:w-auto
                    "
                  >

                    Ver tecidos

                    <ArrowRight
                      className="
                        ml-2
                        h-5
                        w-5
                      "
                    />

                  </Button>

                </Link>

              </div>

            </div>

          </div>

        </section>


        <section
          className="
            py-16
            md:py-20
          "
        >

          <div
            className="
              container
              mx-auto
              grid
              gap-10
              px-6
              lg:grid-cols-[1.1fr_0.9fr]
            "
          >

            <div>

              <p
                className="
                  mb-3
                  text-sm
                  font-bold
                  uppercase
                  tracking-widest
                  text-accent
                "
              >
                Compra profissional
              </p>


              <h2
                className="
                  text-3xl
                  font-bold
                  md:text-4xl
                "
              >
                Encontre o tecido certo para sua coleção
              </h2>


              <p
                className="
                  mt-5
                  max-w-2xl
                  text-lg
                  leading-relaxed
                  text-muted-foreground
                "
              >
                {config.body}
              </p>


              <div
                className="
                  mt-8
                  grid
                  gap-4
                  sm:grid-cols-2
                "
              >

                {
                  config.points.map(
                    point => (

                      <div
                        key={
                          point
                        }
                        className="
                          flex
                          gap-3
                          rounded-2xl
                          border
                          bg-card
                          p-4
                        "
                      >

                        <CheckCircle2
                          className="
                            mt-0.5
                            h-5
                            w-5
                            shrink-0
                            text-accent
                          "
                        />

                        <span
                          className="
                            text-sm
                            leading-relaxed
                          "
                        >
                          {point}
                        </span>

                      </div>

                    )
                  )
                }

              </div>

            </div>


            <div
              className="
                rounded-3xl
                bg-muted/40
                p-7
                md:p-9
              "
            >

              <Search
                className="
                  h-9
                  w-9
                  text-accent
                "
              />


              <h2
                className="
                  mt-5
                  text-2xl
                  font-bold
                "
              >
                O que empresas procuram
              </h2>


              <div
                className="
                  mt-6
                  flex
                  flex-wrap
                  gap-2
                "
              >

                {
                  config.searchTerms.map(
                    term => (

                      <span
                        key={
                          term
                        }
                        className="
                          rounded-full
                          border
                          bg-background
                          px-4
                          py-2
                          text-sm
                        "
                      >
                        {term}
                      </span>

                    )
                  )
                }

              </div>


              <h3
                className="
                  mt-8
                  font-semibold
                "
              >
                Aplicações
              </h3>


              <div
                className="
                  mt-3
                  flex
                  flex-wrap
                  gap-2
                "
              >

                {
                  config.applications.map(
                    application => (

                      <span
                        key={
                          application
                        }
                        className="
                          rounded-lg
                          bg-primary
                          px-3
                          py-2
                          text-sm
                          text-primary-foreground
                        "
                      >
                        {application}
                      </span>

                    )
                  )
                }

              </div>

            </div>

          </div>

        </section>


        <section
          className="
            border-y
            bg-muted/30
            py-16
            md:py-20
          "
        >

          <div
            className="
              container
              mx-auto
              px-6
            "
          >

            <div
              className="
                mx-auto
                max-w-3xl
                text-center
              "
            >

              <Sparkles
                className="
                  mx-auto
                  h-9
                  w-9
                  text-accent
                "
              />


              <h2
                className="
                  mt-5
                  text-3xl
                  font-bold
                  md:text-4xl
                "
              >
                Tecnologias têxteis
              </h2>


              <p
                className="
                  mt-4
                  text-muted-foreground
                "
              >
                Consulte quais tecnologias estão disponíveis em cada tecido.
              </p>

            </div>


            <div
              className="
                mx-auto
                mt-9
                flex
                max-w-4xl
                flex-wrap
                justify-center
                gap-3
              "
            >

              {
                technologies.map(
                  technology => (

                    <Link
                      key={
                        technology
                      }
                      to="/tecnologias"
                      className="
                        rounded-full
                        border
                        bg-background
                        px-5
                        py-3
                        text-sm
                        font-medium
                        transition
                        hover:border-accent
                        hover:text-accent
                      "
                    >
                      {technology}
                    </Link>

                  )
                )
              }

            </div>

          </div>

        </section>


        <section
          className="
            py-16
            md:py-20
          "
        >

          <div
            className="
              container
              mx-auto
              px-6
            "
          >

            <div
              className="
                mx-auto
                max-w-5xl
              "
            >

              <h2
                className="
                  text-center
                  text-3xl
                  font-bold
                  md:text-4xl
                "
              >
                Como comprar tecido no atacado
              </h2>


              <div
                className="
                  mt-10
                  grid
                  gap-5
                  md:grid-cols-3
                "
              >

                {
                  [
                    {
                      number:
                        "01",

                      title:
                        "Escolha sua aplicação",

                      text:
                        "Conte para nossa equipe o que sua marca pretende produzir."
                    },

                    {
                      number:
                        "02",

                      title:
                        "Consulte os tecidos",

                      text:
                        "Receba orientação sobre artigos, tecnologias e cores disponíveis."
                    },

                    {
                      number:
                        "03",

                      title:
                        "Receba as condições",

                      text:
                        "Solicite informações comerciais e opções adequadas ao seu pedido."
                    }
                  ].map(
                    item => (

                      <div
                        key={
                          item.number
                        }
                        className="
                          rounded-3xl
                          border
                          bg-card
                          p-7
                        "
                      >

                        <span
                          className="
                            text-sm
                            font-black
                            tracking-widest
                            text-accent
                          "
                        >
                          {item.number}
                        </span>

                        <h3
                          className="
                            mt-4
                            text-xl
                            font-bold
                          "
                        >
                          {item.title}
                        </h3>

                        <p
                          className="
                            mt-3
                            text-sm
                            leading-relaxed
                            text-muted-foreground
                          "
                        >
                          {item.text}
                        </p>

                      </div>

                    )
                  )
                }

              </div>

            </div>

          </div>

        </section>


        <section
          className="
            bg-primary
            py-16
            text-primary-foreground
            md:py-20
          "
        >

          <div
            className="
              container
              mx-auto
              px-6
            "
          >

            <div
              className="
                mx-auto
                max-w-4xl
                text-center
              "
            >

              <ShieldCheck
                className="
                  mx-auto
                  h-10
                  w-10
                  text-accent
                "
              />


              <h2
                className="
                  mt-5
                  text-3xl
                  font-bold
                  md:text-4xl
                "
              >
                Fale com a equipe comercial
              </h2>


              <p
                className="
                  mx-auto
                  mt-4
                  max-w-2xl
                  text-white/75
                "
              >
                Informe o tipo de produto que sua empresa fabrica e receba orientação para encontrar o tecido mais adequado.
              </p>


              <div
                className="
                  mt-8
                  flex
                  flex-col
                  justify-center
                  gap-3
                  sm:flex-row
                "
              >

                <a
                  href={
                    quoteUrl
                  }
                  target={
                    phone
                      ?
                        "_blank"
                      :
                        undefined
                  }
                  rel={
                    phone
                      ?
                        "noopener noreferrer"
                      :
                        undefined
                  }
                  onClick={
                    clickQuote
                  }
                >

                  <Button
                    size="lg"
                    className="
                      w-full
                      bg-accent
                      text-accent-foreground
                      hover:bg-accent/90
                      sm:w-auto
                    "
                  >
                    Solicitar orçamento
                  </Button>

                </a>


                <a
                  href={
                    sampleUrl
                  }
                  target={
                    phone
                      ?
                        "_blank"
                      :
                        undefined
                  }
                  rel={
                    phone
                      ?
                        "noopener noreferrer"
                      :
                        undefined
                  }
                  onClick={
                    clickSample
                  }
                >

                  <Button
                    size="lg"
                    variant="outline"
                    className="
                      w-full
                      border-white/30
                      bg-transparent
                      text-white
                      hover:bg-white/10
                      hover:text-white
                      sm:w-auto
                    "
                  >
                    Consultar amostra
                  </Button>

                </a>

              </div>

            </div>

          </div>

        </section>


        <section
          className="
            py-16
            md:py-20
          "
        >

          <div
            className="
              container
              mx-auto
              max-w-4xl
              px-6
            "
          >

            <h2
              className="
                text-center
                text-3xl
                font-bold
              "
            >
              Dúvidas sobre compras no atacado
            </h2>


            <div
              className="
                mt-9
                space-y-4
              "
            >

              {
                faqs.map(
                  faq => (

                    <details
                      key={
                        faq.question
                      }
                      className="
                        group
                        rounded-2xl
                        border
                        bg-card
                        p-5
                      "
                    >

                      <summary
                        className="
                          cursor-pointer
                          list-none
                          font-semibold
                        "
                      >
                        {faq.question}
                      </summary>

                      <p
                        className="
                          mt-3
                          leading-relaxed
                          text-muted-foreground
                        "
                      >
                        {faq.answer}
                      </p>

                    </details>

                  )
                )
              }

            </div>

          </div>

        </section>


        <section
          className="
            border-t
            bg-muted/30
            py-14
          "
        >

          <div
            className="
              container
              mx-auto
              px-6
            "
          >

            <h2
              className="
                text-2xl
                font-bold
              "
            >
              Encontre por categoria
            </h2>


            <div
              className="
                mt-6
                grid
                gap-4
                md:grid-cols-3
              "
            >

              {
                [
                  {
                    to:
                      "/tecido-fitness-atacado",

                    label:
                      "Tecido Fitness no Atacado"
                  },

                  {
                    to:
                      "/tecido-poliamida-atacado",

                    label:
                      "Poliamida no Atacado"
                  },

                  {
                    to:
                      "/tecido-moda-praia-atacado",

                    label:
                      "Tecido Moda Praia no Atacado"
                  }
                ].map(
                  item => (

                    <Link
                      key={
                        item.to
                      }
                      to={
                        item.to
                      }
                      className="
                        flex
                        items-center
                        justify-between
                        rounded-2xl
                        border
                        bg-background
                        p-5
                        font-semibold
                        transition
                        hover:border-accent
                        hover:text-accent
                      "
                    >

                      {item.label}

                      <ArrowRight
                        className="
                          h-5
                          w-5
                        "
                      />

                    </Link>

                  )
                )
              }

            </div>

          </div>

        </section>

              <WholesaleFabricLinks />
      </main>


      <WholesaleAIFacts />
      <Footer />

    </div>
  );
}
