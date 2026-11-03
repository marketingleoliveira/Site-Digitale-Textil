import {
  ArrowRight,
  MessageCircle
} from "lucide-react";

import {
  Link
} from "react-router-dom";

import {
  Button
} from "@/components/ui/button";

import {
  useSiteSettings
} from "@/hooks/useSiteSettings";

import {
  trackWholesaleEvent
} from "@/lib/wholesale-tracking";


export function WholesaleHomeCTA() {

  const {
    whatsappNumber
  } =
    useSiteSettings();


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
      "Olá! Vim pelo site da Digitale Têxtil e gostaria de informações para comprar tecidos no atacado."
    );


  const whatsapp =
    phone
      ?
        `https://wa.me/${phone}?text=${message}`
      :
        "/contato";


  return (
    <section
      className="
        border-y
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
            overflow-hidden
            rounded-3xl
            bg-primary
            px-7
            py-10
            text-primary-foreground
            md:px-12
            md:py-14
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

            <div
              className="
                max-w-3xl
              "
            >

              <p
                className="
                  text-sm
                  font-bold
                  uppercase
                  tracking-[0.2em]
                  text-accent
                "
              >
                PARA MARCAS E CONFECÇÕES
              </p>


              <h2
                className="
                  mt-3
                  text-3xl
                  font-bold
                  md:text-4xl
                "
              >
                Procurando tecidos no atacado?
              </h2>


              <p
                className="
                  mt-4
                  max-w-2xl
                  leading-relaxed
                  text-white/75
                "
              >
                Conheça tecidos para fitness, moda praia e projetos de confecção e fale diretamente com nossa equipe comercial.
              </p>

            </div>


            <div
              className="
                flex
                flex-col
                gap-3
                sm:flex-row
                lg:flex-col
              "
            >

              <Link
                to="/atacado"
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
                  Comprar no atacado

                  <ArrowRight
                    className="
                      ml-2
                      h-5
                      w-5
                    "
                  />

                </Button>

              </Link>


              <a
                href={
                  whatsapp
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
                      "wholesale_whatsapp_click",
                      {
                        page:
                          "home"
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
                    bg-transparent
                    text-white
                    hover:bg-white/10
                    hover:text-white
                  "
                >

                  WhatsApp

                  <MessageCircle
                    className="
                      ml-2
                      h-5
                      w-5
                    "
                  />

                </Button>

              </a>

            </div>

          </div>

        </div>

      </div>

    </section>
  );
}
