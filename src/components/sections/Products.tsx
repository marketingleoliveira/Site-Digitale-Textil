import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoColor from "@/assets/logo-color.png";
import { Skeleton } from "@/components/ui/skeleton";
import { isVideoUrl } from "@/lib/media-utils";

// Fallback images
import fabricMilano from "@/assets/fabric-milano.jpg";
import fabricLyon from "@/assets/fabric-lyon.jpg";
import fabricAerodry from "@/assets/fabric-aerodry.jpg";
import fabricVeneza from "@/assets/fabric-veneza.jpg";
import fabricOceanic from "@/assets/fabric-oceanic.jpg";
import fabricOceanicEco from "@/assets/fabric-oceanic-eco.jpg";
import fabricSoftskin from "@/assets/fabric-softskin.jpg";
import fabricIntense from "@/assets/fabric-intense.jpg";
import fabricCorsega from "@/assets/fabric-corsega.jpg";
import fabricVelocity from "@/assets/fabric-velocity.jpg";
import fabricFlow from "@/assets/fabric-flow.jpg";
import fabricCaribe from "@/assets/fabric-caribe.jpg";
import fabricParis from "@/assets/fabric-paris.jpg";

// Default images mapping by slug
const defaultImages: Record<string, string> = {
  milano: fabricMilano,
  lyon: fabricLyon,
  aerodry: fabricAerodry,
  veneza: fabricVeneza,
  oceanic: fabricOceanic,
  "oceanic-eco": fabricOceanicEco,
  softskin: fabricSoftskin,
  intense: fabricIntense,
  corsega: fabricCorsega,
  velocity: fabricVelocity,
  flow: fabricFlow,
  caribe: fabricCaribe,
  paris: fabricParis
};

// Helper function to get fabric image
const getFabricImage = (fabric: {slug?: string;image_url?: string | null;}) => {
  if (fabric.image_url) return fabric.image_url;
  if (fabric.slug && defaultImages[fabric.slug]) return defaultImages[fabric.slug];
  return fabricMilano;
};

const fallbackFabrics = [
{ name: "Milano", slug: "milano", image_url: fabricMilano, short_description: "Tecido de alta compressão, ideal para leggings e shorts fitness." },
{ name: "Lyon", slug: "lyon", image_url: fabricLyon, short_description: "Malha com toque suave e caimento perfeito." },
{ name: "Aerodry", slug: "aerodry", image_url: fabricAerodry, short_description: "Tecnologia dry fit avançada com secagem ultra-rápida." },
{ name: "Veneza", slug: "veneza", image_url: fabricVeneza, short_description: "Acabamento acetinado premium com brilho sofisticado." }];



export function Products() {
  const { t } = useLanguage();

  const { data: fabrics, isLoading: fabricsLoading } = useQuery({
    queryKey: ["featured-fabrics-home"],
    queryFn: async () => {
      const { data: featuredData, error: featuredError } = await supabase.
      from("fabrics").
      select("id, name, slug, image_url, short_description").
      eq("is_active", true).
      eq("is_featured", true).
      order("display_order", { ascending: true }).
      limit(4);

      if (featuredError) throw featuredError;

      if (featuredData && featuredData.length > 0) {
        return featuredData;
      }

      const { data, error } = await supabase.
      from("fabrics").
      select("id, name, slug, image_url, short_description").
      eq("is_active", true).
      order("created_at", { ascending: false }).
      limit(4);

      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 2
  });

  const { data: prints, isLoading: printsLoading } = useQuery({
    queryKey: ["latest-prints-home"],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("prints").
      select("id, code, name, image_url").
      eq("is_active", true).
      order("created_at", { ascending: false }).
      limit(6);

      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 2
  });

  const displayFabrics = fabrics && fabrics.length > 0 ? fabrics : fallbackFabrics;

  return (
    <section data-digitale-fabrics="true" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        {/* Fabrics Section */}
        <div className="text-center mb-10 md:mb-12">
          <h2 className="section-title"><span className="md:hidden">Tecidos que valorizam sua coleção.</span><span className="hidden md:inline">Tecidos Confort</span></h2>

        </div>

        {/* Fabrics Grid */}
        {fabricsLoading ?
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {[...Array(4)].map((_, i) =>
          <div key={i} className="space-y-3">
                <Skeleton className="h-48 md:h-72 rounded-xl" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
          )}
          </div> :

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            {displayFabrics.map((fabric, index) =>
          <div
            key={fabric.slug || index}
            className="group">

                <Link to={`/tecidos/${fabric.slug}`} className="block">
                  <div className="relative bg-card rounded-xl md:rounded-2xl overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-2">
                    {/* Image Container */}
                    <div className="relative h-48 md:h-72 overflow-hidden">
                      {isVideoUrl(getFabricImage(fabric)) ?
                  <video
                    src={getFabricImage(fabric)}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    muted loop autoPlay playsInline /> :


                  <img
                    src={getFabricImage(fabric)}
                    alt={fabric.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  }

                      {/* Gradient Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Logo Badge */}
                      <div className="hidden md:flex absolute top-2 right-2 md:top-3 md:right-3 w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg items-center justify-center shadow-lg p-1.5 transition-transform duration-300 group-hover:scale-110">
                        <img
                      src={logoColor}
                      alt="Digitale"
                      className="w-full h-full object-contain" />

                      </div>
                      {/* DIGITALE_FABRICS_IMAGE_TITLE_OVERLAY_V2 */}
                      <div className="md:hidden digitale-fabric-mobile-title-wrap absolute inset-x-0 bottom-0 z-20">
                        <div className="digitale-fabric-mobile-title-gradient absolute inset-x-0 bottom-0 h-24 pointer-events-none" />
                        <div className="relative px-4 pb-4 pt-10">
                          <h3 className="digitale-fabric-mobile-title text-white">
                            {fabric.name}
                          </h3>
                        </div>
                      </div>

                      {/* Hover Content */}
                      <div className="absolute inset-0 hidden md:flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-white text-foreground px-5 py-2.5 rounded-full font-semibold shadow-xl flex items-center gap-2 text-sm">
                          {t("products.viewMore")}
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="hidden md:block md:p-5 bg-card">
                      <h3 className="text-sm md:text-lg font-bold text-foreground mb-1 group-hover:text-accent transition-colors duration-300">
                        {fabric.name}
                      </h3>
                      {/* DIGITALE_FABRICS_COMMERCIAL_MOBILE_V1 */}

                      <p className="hidden md:block text-muted-foreground text-xs md:text-sm line-clamp-2">
                        {fabric.short_description}
                      </p>

                      <p className="md:hidden digitale-fabric-description text-muted-foreground text-xs">
                        {(() => {
                          const name = (fabric.name || "").toLowerCase();

                          if (name.includes("milano"))
                            return "Mais estrutura para sua linha fitness.";

                          if (name.includes("lyon"))
                            return "Textura que valoriza cada peça.";

                          if (name.includes("aerodry"))
                            return "Leveza e desempenho para suas criações.";

                          if (name.includes("veneza"))
                            return "Um acabamento que faz a diferença.";

                          return fabric.short_description;
                        })()}
                      </p>
                      
                      {/* Arrow indicator */}
                      <div className="hidden md:flex mt-3 items-center gap-2 text-accent font-semibold text-sm">
                        <span>{t("products.viewMore")}</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
          )}
          </div>
        }

        {/* Seção Novas Estampas removida da homepage */}
      </div>
    </section>);

}