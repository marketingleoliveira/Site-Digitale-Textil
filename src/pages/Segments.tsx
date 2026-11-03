import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { ArrowRight, Waves, Dumbbell, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { trackEvent } from "@/lib/tracking";

// Fallback images
import segmentPraiaImg from "@/assets/segment-praia.jpg";
import segmentEsportivoImg from "@/assets/segment-esportivo.jpg";

interface Subcategory {
  name: string;
  description: string;
  features: string[];
}

interface Fabric {
  name: string;
  slug: string;
}

interface Segment {
  id: string;
  slug: string;
  name: string;
  icon: string;
  hero_image: string | null;
  description: string | null;
  features: string[];
  fabrics: Fabric[];
  subcategories: Subcategory[];
}

const fallbackImages: Record<string, string> = {
  praia: segmentPraiaImg,
  esportivo: segmentEsportivoImg,
};

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  waves: Waves,
  dumbbell: Dumbbell,
};

const Segments = () => {
  const { t } = useLanguage();
  const { whatsappNumber } = useSiteSettings();
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const { data: segments, isLoading } = useQuery({
    queryKey: ["segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segments")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;

      return (data || []).map((s: any) => ({
        ...s,
        features: Array.isArray(s.features) ? s.features : [],
        fabrics: Array.isArray(s.fabrics) ? s.fabrics : [],
        subcategories: Array.isArray(s.subcategories) ? s.subcategories : [],
      })) as Segment[];
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <SEO title="Segmentos – Moda Fitness, Praia e Sportwear" description="Tecidos sob medida para os segmentos de moda fitness, moda praia, sportwear e beachwear. Soluções têxteis para cada nicho de confecção." keywords="moda fitness, moda praia, sportwear, beachwear, segmentos têxteis, tecidos para confecção" />
      <main>
        {/* Hero Section */}
        <section className="relative py-20 md:py-28 bg-gradient-to-br from-primary via-primary/95 to-primary/90 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1920&q=80')] bg-cover bg-center opacity-10" />
          <div className="container mx-auto px-6 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-3xl mx-auto"
            >
              <span className="text-accent font-medium text-sm uppercase tracking-wider">
                Segmentos
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mt-4 mb-6 leading-tight">
                Soluções para Cada Segmento
              </h1>
              <p className="text-lg md:text-xl text-white/80">
                Tecidos especializados para atender às necessidades específicas de cada mercado.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Segments Grid */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6">
            {isLoading ? (
              <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="aspect-[16/10] rounded-3xl" />
                ))}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                {segments?.map((segment, index) => {
                  const IconComponent = iconComponents[segment.icon] || Waves;
                  const imageUrl = segment.hero_image || fallbackImages[segment.slug] || segmentPraiaImg;

                  return (
                    <motion.div
                      key={segment.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="group cursor-pointer"
                      onClick={() => {
                        const opening = selectedSegment !== segment.id;
                        if (opening) {
                          void trackEvent("segment_interest", {
                            entityType: "segment",
                            entitySlug: segment.slug,
                            metadata: { name: segment.name },
                          });
                        }
                        setSelectedSegment(opening ? segment.id : null);
                      }}
                    >
                      <div className={`relative rounded-3xl overflow-hidden transition-all duration-500 ${
                        selectedSegment === segment.id 
                          ? "ring-4 ring-accent shadow-2xl" 
                          : "hover:shadow-xl"
                      }`}>
                        {/* Image */}
                        <div className="relative aspect-[16/10] overflow-hidden">
                          <img
                            src={imageUrl}
                            alt={segment.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                          
                          {/* Content Overlay */}
                          <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-3 bg-accent rounded-xl">
                                <IconComponent className="h-6 w-6 text-accent-foreground" />
                              </div>
                              <h2 className="text-2xl md:text-3xl font-bold text-white">
                                {segment.name}
                              </h2>
                            </div>
                            <p className="text-white/80 text-sm md:text-base mb-4 line-clamp-2">
                              {segment.description}
                            </p>
                            
                            {/* Features Pills */}
                            <div className="flex flex-wrap gap-2 mb-4">
                              {segment.features.slice(0, 3).map((feature) => (
                                <span
                                  key={feature}
                                  className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                            
                            <div className="flex items-center text-accent font-medium">
                              <span>Ver aplicações</span>
                              <ChevronRight className={`h-5 w-5 ml-1 transition-transform duration-300 ${
                                selectedSegment === segment.id ? "rotate-90" : ""
                              }`} />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded Content */}
                      {selectedSegment === segment.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="mt-4 p-6 bg-muted/50 rounded-2xl border border-border"
                        >
                          {/* Subcategories */}
                          {segment.subcategories.length > 0 && (
                            <div className="mb-6">
                              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                                Aplicações
                              </h3>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {segment.subcategories.map((sub) => (
                                  <div
                                    key={sub.name}
                                    className="p-3 bg-background rounded-xl border border-border/50 hover:border-accent/30 transition-colors"
                                  >
                                    <h4 className="font-medium text-foreground text-sm mb-1">
                                      {sub.name}
                                    </h4>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {sub.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Recommended Fabrics */}
                          {segment.fabrics.length > 0 && (
                            <div className="mb-6">
                              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
                                Tecidos Recomendados
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {segment.fabrics.map((fabric) => (
                                  <Link
                                    key={fabric.slug}
                                    to={`/tecidos/${fabric.slug}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="px-4 py-2 bg-accent/10 border border-accent/30 rounded-full text-sm text-accent font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                                  >
                                    {fabric.name}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-3">
                            <Link 
                              to={`/segmentos/${segment.slug}`} 
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="outline" className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                                Ver Detalhes
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </Link>
                            <Link 
                              to="/tecidos" 
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                                Ver Tecidos
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-primary to-primary/90 rounded-3xl p-12 md:p-16 text-center"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Não encontrou seu segmento?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                Entre em contato conosco. Nossa equipe pode desenvolver soluções personalizadas para atender às necessidades específicas do seu mercado.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link to="/contato">
                  <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    Fale Conosco
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    WhatsApp
                  </Button>
                </a>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Segments;
