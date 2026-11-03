import {
  Link
} from "react-router-dom";

import {
  useQuery
} from "@tanstack/react-query";

import {
  ArrowRight
} from "lucide-react";

import {
  supabase
} from "@/integrations/supabase/client";


interface FabricLink {
  name: string;
  slug: string;
  short_description?: string | null;
}


export function WholesaleFabricLinks() {

  const {
    data: fabrics,
    isLoading
  } =
    useQuery({

      queryKey: [
        "wholesale-active-fabrics"
      ],

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
                "name, slug, short_description"
              )
              .eq(
                "is_active",
                true
              )
              .order(
                "display_order",
                {
                  ascending:
                    true
                }
              )
              .limit(
                20
              );


          if (error) {
            throw error;
          }


          return (
            Array.isArray(
              data
            )
              ?
                data
              :
                []
          ) as FabricLink[];
        }
    });


  if (
    isLoading
    ||
    !fabrics?.length
  ) {

    return null;
  }


  return (
    <section
      className="
        border-t
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

          <p
            className="
              text-sm
              font-bold
              uppercase
              tracking-[0.18em]
              text-accent
            "
          >
            TECIDOS DIGITALE
          </p>


          <h2
            className="
              mt-3
              text-3xl
              font-bold
              md:text-4xl
            "
          >
            Conheça nossos tecidos
          </h2>


          <p
            className="
              mt-4
              max-w-2xl
              text-muted-foreground
            "
          >
            Acesse os tecidos disponíveis e consulte nossa equipe para informações comerciais.
          </p>


          <div
            className="
              mt-8
              grid
              gap-4
              sm:grid-cols-2
              lg:grid-cols-3
            "
          >

            {
              fabrics.map(
                fabric => (

                  <Link
                    key={
                      fabric.slug
                    }
                    to={
                      `/tecidos/${fabric.slug}`
                    }
                    className="
                      group
                      rounded-2xl
                      border
                      bg-card
                      p-5
                      transition
                      hover:border-accent
                      hover:shadow-md
                    "
                  >

                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-4
                      "
                    >

                      <div>

                        <h3
                          className="
                            font-semibold
                            transition
                            group-hover:text-accent
                          "
                        >
                          {fabric.name}
                        </h3>


                        {
                          fabric.short_description
                          &&
                          (
                            <p
                              className="
                                mt-2
                                line-clamp-2
                                text-sm
                                text-muted-foreground
                              "
                            >
                              {
                                fabric.short_description
                              }
                            </p>
                          )
                        }

                      </div>


                      <ArrowRight
                        className="
                          h-5
                          w-5
                          shrink-0
                          transition
                          group-hover:translate-x-1
                          group-hover:text-accent
                        "
                      />

                    </div>

                  </Link>

                )
              )
            }

          </div>

        </div>

      </div>

    </section>
  );
}
