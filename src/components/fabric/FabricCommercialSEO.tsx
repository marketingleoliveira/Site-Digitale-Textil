import {
  useEffect
} from "react";

import {
  Link,
  useParams
} from "react-router-dom";

import {
  useQuery
} from "@tanstack/react-query";

import {
  ArrowRight,
  MessageCircle
} from "lucide-react";

import {
  supabase
} from "@/integrations/supabase/client";

import {
  useSiteSettings
} from "@/hooks/useSiteSettings";

import {
  Button
} from "@/components/ui/button";

import {
  trackWholesaleEvent
} from "@/lib/wholesale-tracking";


interface FabricSeoData {
  name: string;
  slug: string;
  short_description?: string | null;
  image_url?: string | null;
}


function absoluteImage(
  value?: string | null
) {

  if (!value) {
    return undefined;
  }


  if (
    value.startsWith(
      "http://"
    )
    ||
    value.startsWith(
      "https://"
    )
  ) {

    return value;
  }


  if (
    typeof window
    === "undefined"
  ) {

    return value;
  }


  return new URL(
    value,
    window.location.origin
  ).href;
}


export function FabricCommercialSEO() {

  const {
    slug
  } =
    useParams<{
      slug: string;
    }>();


  const {
    whatsappNumber
  } =
    useSiteSettings();


  const {
    data: fabric
  } =
    useQuery({

      queryKey: [
        "fabric-commercial-seo",
        slug
      ],

      enabled:
        Boolean(slug),

      queryFn:
        async () => {

          const {
            data,
            error
          } =
            await supabase
              .from(
                "fabrics"
              )
              .select(
                "name, slug, short_description, image_url"
              )
              .eq(
                "slug",
                slug
              )
              .eq(
                "is_active",
                true
              )
              .limit(
                1
              );


          if (error) {
            throw error;
          }


          const rows =
            Array.isArray(
              data
            )
              ?
                data
              :
                data
                  ?
                    [data]
                  :
                    [];


          return (
            rows[0]
            ||
            null
          ) as FabricSeoData | null;
        }
    });


  const name =
    fabric?.name
    ||
    String(
      slug
      || "Tecido"
    )
      .replace(
        /-/g,
        " "
      )
      .replace(
        /\b\w/g,
        letter =>
          letter.toUpperCase()
      );


  const description =
    fabric?.short_description
    ||
    `Conheça o tecido ${name} da Digitale Têxtil. Consulte aplicações, cores, tecnologias disponíveis e condições para compras no atacado.`;


  const canonical =
    slug
      ?
        `https://digitaletextil.com.br/tecidos/${encodeURIComponent(slug)}`
      :
        "https://digitaletextil.com.br/tecidos";


  const phone =
    String(
      whatsappNumber
      || ""
    )
      .replace(
        /\D/g,
        ""
      );


  const message =
    encodeURIComponent(
      `Olá! Vim pelo site da Digitale Têxtil e gostaria de informações comerciais sobre o tecido ${name} para compra no atacado.`
    );


  const whatsappUrl =
    phone
      ?
        `https://wa.me/${phone}?text=${message}`
      :
        "/contato";


  useEffect(
    () => {

      if (!slug) {
        return;
      }


      const previousTitle =
        document.title;


      document.title =
        `${name} no Atacado | Digitale Têxtil`;


      const descriptionMeta =
        document.querySelector<HTMLMetaElement>(
          'meta[name="description"]'
        );


      const oldDescription =
        descriptionMeta?.getAttribute(
          "content"
        )
        ||
        null;


      const createdDescription =
        !descriptionMeta;


      const meta =
        descriptionMeta
        ||
        document.createElement(
          "meta"
        );


      meta.setAttribute(
        "name",
        "description"
      );

      meta.setAttribute(
        "content",
        description
      );


      if (
        createdDescription
      ) {

        document.head.appendChild(
          meta
        );
      }


      const currentCanonical =
        document.querySelector<HTMLLinkElement>(
          'link[rel="canonical"]'
        );


      const createdCanonical =
        !currentCanonical;


      const canonicalElement =
        currentCanonical
        ||
        document.createElement(
          "link"
        );


      const oldCanonical =
        canonicalElement.getAttribute(
          "href"
        );


      canonicalElement.setAttribute(
        "rel",
        "canonical"
      );

      canonicalElement.setAttribute(
        "href",
        canonical
      );


      if (
        createdCanonical
      ) {

        document.head.appendChild(
          canonicalElement
        );
      }


      const oldSchema =
        document.getElementById(
          "digitale-fabric-product-jsonld"
        );


      oldSchema?.remove();


      const schema =
        document.createElement(
          "script"
        );


      schema.id =
        "digitale-fabric-product-jsonld";

      schema.type =
        "application/ld+json";


      const image =
        absoluteImage(
          fabric?.image_url
        );


      schema.text =
        JSON.stringify({

          "@context":
            "https://schema.org",

          "@type":
            "Product",

          name,

          description,

          url:
            canonical,

          category:
            "Tecido técnico",

          brand: {
            "@type":
              "Brand",

            name:
              "Digitale Têxtil"
          },

          ...(image
            ?
              {
                image: [
                  image
                ]
              }
            :
              {})
        });


      document.head.appendChild(
        schema
      );


      return () => {

        document.title =
          previousTitle;


        schema.remove();


        if (
          createdDescription
        ) {

          meta.remove();

        } else if (
          oldDescription
        ) {

          meta.setAttribute(
            "content",
            oldDescription
          );
        }


        if (
          createdCanonical
        ) {

          canonicalElement.remove();

        } else if (
          oldCanonical
        ) {

          canonicalElement.setAttribute(
            "href",
            oldCanonical
          );
        }
      };

    },

    [
      slug,
      name,
      description,
      canonical,
      fabric?.image_url
    ]
  );


  if (!slug) {
    return null;
  }


  return (
    <section
      className="
        border-t
        bg-muted/30
        py-14
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
            overflow-hidden
            rounded-3xl
            bg-primary
            px-7
            py-10
            text-primary-foreground
            md:px-12
            md:py-12
          "
        >

          <div
            className="
              grid
              items-center
              gap-8
              lg:grid-cols-[1fr_auto]
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-bold
                  uppercase
                  tracking-[0.18em]
                  text-accent
                "
              >
                COMPRA NO ATACADO
              </p>


              <h2
                className="
                  mt-3
                  text-3xl
                  font-bold
                  md:text-4xl
                "
              >
                Interessado no tecido {name}?
              </h2>


              <p
                className="
                  mt-4
                  max-w-2xl
                  leading-relaxed
                  text-white/75
                "
              >
                Fale com nossa equipe comercial para consultar aplicações, cores, tecnologias disponíveis e condições comerciais.
              </p>

            </div>


            <div
              className="
                flex
                flex-col
                gap-3
              "
            >

              <a
                href={
                  whatsappUrl
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
                  () =>
                    trackWholesaleEvent(
                      "wholesale_quote_click",
                      {
                        page:
                          `tecido_${slug}`,

                        fabric:
                          name
                      }
                    )
                }
              >

                <Button
                  size="lg"
                  className="
                    w-full
                    bg-accent
                    text-accent-foreground
                    hover:bg-accent/90
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
                to="/atacado"
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
                  "
                >

                  Ver atendimento atacado

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

      </div>

    </section>
  );
}
