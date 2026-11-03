import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/tracking";

import badgeAloeVera from "@/assets/tech-badges/aloe-vera.webp";
import badgeUV50 from "@/assets/tech-badges/uv50.webp";
import badgeAntibacteriano from "@/assets/tech-badges/antibacteriano.webp";
import badgeSuperBlack from "@/assets/tech-badges/super-black.webp";
import badge4WayStretch from "@/assets/tech-badges/4-way-stretch.webp";
import badgeZeroTransparencia from "@/assets/tech-badges/zero-transparencia.webp";
import badgeCreora from "@/assets/tech-badges/creora.png";
import badgeDigitaleEco from "@/assets/tech-badges/digitale-eco.webp";
import badgeEstampariaHD from "@/assets/tech-badges/super-brilho.png";
import badgeSuperMicrofibra from "@/assets/tech-badges/super-micro-fibra.webp";

const badgeMap: Record<string, string> = {
  "ALOE VERA": badgeAloeVera,
  "PROTEÇÃO UV 50+": badgeUV50,
  "ANTIBACTERIANO": badgeAntibacteriano,
  "SUPER BLACK": badgeSuperBlack,
  "4 WAY STRETCH": badge4WayStretch,
  "ZERO TRANSPARÊNCIA": badgeZeroTransparencia,
  "CREORA": badgeCreora,
  "DIGITALE ECO": badgeDigitaleEco,
  "ESTAMPARIA DIGITAL HD": badgeEstampariaHD,
  "SUPER MICROFIBRA": badgeSuperMicrofibra,
  "DRY FAST": badgeDigitaleEco, // Fallback
};

export interface Technology {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  icon_url: string | null;
  benefits: string[];
  applications: string[];
  is_featured: boolean;
  display_order: number;
}

/** Converte o valor jsonb (array ou string) em lista de strings segura. */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
    } catch {
      return value.split("\n").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Resolve dinamicamente um ícone Lucide pelo nome; usa Sparkles como fallback. */
function resolveIcon(name?: string | null) {
  if (!name) return Sparkles;
  const dict = Icons as unknown as Record<string, unknown>;
  const found = dict[name];
  return (typeof found === "function" || typeof found === "object") && found
    ? (found as typeof Sparkles)
    : Sparkles;
}

/** Define a cor de fundo e do ícone baseada no nome da tecnologia (referência visual) */
function getTechStyles(name: string) {
  const n = name.toUpperCase();
  if (n.includes("PROTEÇÃO")) return "bg-[#FF8A00] text-white"; // Laranja
  if (n.includes("ANTIBACTERIANO")) return "bg-[#8BC34A] text-white"; // Verde
  if (n.includes("CREORA")) return "bg-white text-primary border border-gray-100 shadow-sm"; // Branco/Logo
  if (n.includes("ALOE VERA")) return "bg-[#A4C639] text-white"; // Verde claro
  if (n.includes("SUPER BLACK")) return "bg-black text-white"; // Preto
  if (n.includes("DIGITALE ECO")) return "bg-[#006837] text-white"; // Verde escuro
  if (n.includes("ESTAMPARIA")) return "bg-gradient-to-br from-[#FF0080] via-[#FF8C00] to-[#40E0D0] text-white"; // Colorido
  if (n.includes("4 WAY")) return "bg-white text-black border border-gray-200 shadow-sm"; 
  if (n.includes("ZERO")) return "bg-[#e5e5e5] text-black"; 
  return "bg-primary text-white";
}

const Technologies = () => {
  const { whatsappLink } = useSiteSettings();
  const [selected, setSelected] = useState<Technology | null>(null);

  const { data: technologies, isLoading } = useQuery({
    queryKey: ["technologies", "public"],
    queryFn: async (): Promise<Technology[]> => {
      const { data, error } = await supabase
        .from("technologies")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map((t) => ({
        ...t,
        benefits: toList(t.benefits),
        applications: toList(t.applications),
      })) as Technology[];
    },
  });

  const list = technologies ?? [];

  // Dividir o nome em Título e Subtítulo para o estilo visual
  const getDisplayNames = (name: string) => {
    const parts = name.split(" ");
    if (parts.length > 1) {
      // Se tiver mais de uma palavra, a primeira é o título principal e o resto o subtítulo
      if (name.toUpperCase().includes("PROTEÇÃO UV")) {
        return { title: "PROTEÇÃO", subtitle: "UV 50+" };
      }
      if (name.toUpperCase().includes("ANTIBACTERIANO")) {
        return { title: "ANTIBACTERIANO", subtitle: "MICRO-STOP" };
      }
      if (name.toUpperCase().includes("CREORA")) {
        return { title: "CREORA®", subtitle: "HIGHCLO" };
      }
      if (name.toUpperCase().includes("ESTAMPARIA DIGITAL HD")) {
        return { title: "ESTAMPARIA DIGITAL", subtitle: "HD" };
      }
      return { title: parts[0], subtitle: parts.slice(1).join(" ") };
    }
    return { title: name, subtitle: "" };
  };

  // Componente do ícone da tecnologia selecionada (renderizado como JSX, nunca chamado como função)
  const SelectedIcon = selected ? resolveIcon(selected.icon) : null;

  return (
    <div className="min-h-screen bg-background font-sans">
      <SEO
        title="Tecnologias Têxteis | Malhas Técnicas e Acabamentos"
        description="Conheça as tecnologias da Digitale Têxtil: proteção UV, secagem rápida, antibacteriano, creora, aloe vera, digitale eco e mais."
        keywords="tecnologia têxtil, malha com proteção UV, tecido dry fit, tecido antibacteriano, estamparia digital, super black, creora, sustentabilidade têxtil"
      />
      <Header />

      <main className="bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-20">
          <div className="container relative mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-4xl"
            >
              <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight text-[#213754]">
                TECNOLOGIAS <span className="text-[#FF8A00]">DIGITALE</span>
              </h1>
              <div className="mt-6 flex flex-col items-center justify-center space-y-3">
                <div className="h-[3px] w-14 bg-[#FF8A00] rounded-full" />
                <p className="text-sm md:text-base font-medium uppercase tracking-[0.2em] text-[#213754]">
                  INOVAÇÃO E <span className="font-bold">PERFORMANCE</span> EM CADA FIBRA.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Grid de Tecnologias - Layout Horizontal estilo Referência */}
        <section className="bg-[#f0f4f8] py-16 md:py-24">
          <div className="container mx-auto px-4 lg:px-20 max-w-7xl">
            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-[2.5rem]" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl shadow-sm">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-lg">
                  Nenhuma tecnologia cadastrada no momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-12">
                {list.map((tech, index) => {
                  const Icon = resolveIcon(tech.icon);
                  const styles = getTechStyles(tech.name);
                  const { title, subtitle } = getDisplayNames(tech.name);
                  
                  return (
                    <motion.article
                      key={tech.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className={cn(
                        "group relative flex flex-col sm:flex-row items-center sm:items-start gap-8 rounded-[2.5rem] bg-white p-10 sm:p-12",
                        "shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1)] transition-all duration-300 cursor-pointer"
                      )}
                      onClick={() => {
                        void trackEvent("technology_interest", {
                          entityType: "technology",
                          entitySlug: tech.slug || tech.name,
                          metadata: { name: tech.name },
                        });
                        setSelected(tech);
                      }}
                    >
                      {/* Logo Circular */}
                      <div 
                        className={cn(
                          "flex h-28 w-28 md:h-32 md:w-32 shrink-0 items-center justify-center rounded-full text-center p-0 overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-300 bg-white",
                          (!tech.icon_url && !badgeMap[tech.name.toUpperCase()]) && styles
                        )}
                      >
                        {tech.icon_url ? (
                          <img 
                            src={tech.icon_url} 
                            alt={tech.name}
                            className="h-full w-full object-contain"
                          />
                        ) : badgeMap[tech.name.toUpperCase()] ? (
                          <img 
                            src={badgeMap[tech.name.toUpperCase()]} 
                            alt={tech.name}
                            className="h-full w-full object-contain"
                          />
                        ) : tech.name.toUpperCase().includes("CREORA") ? (
                          <div className="flex flex-col items-center justify-center scale-90 sm:scale-100">
                             <span className="text-[#213754] text-2xl md:text-3xl font-bold tracking-tighter leading-none">creora®</span>
                             <div className="mt-1 h-[1px] w-8 bg-[#FF8A00]" />
                             <span className="text-[6px] md:text-[7px] text-[#555] mt-1 font-medium italic">its in our every fiber</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Icon className="h-10 w-10 md:h-12 md:w-12" />
                            <span className="text-[9px] md:text-[10px] font-bold leading-tight uppercase px-2 line-clamp-2">
                              {tech.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex flex-1 flex-col text-center sm:text-left">
                        <div className="mb-4">
                          <h2 className="font-display text-2xl md:text-3xl font-bold text-[#213754] uppercase tracking-tight">
                            {title}
                          </h2>
                          {subtitle && (
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mt-1">
                              <span className="text-xl md:text-2xl font-bold text-[#FF8A00] uppercase">
                                {subtitle}
                              </span>
                              <div className="hidden sm:block mt-3.5 h-[3px] w-8 bg-[#FF8A00] rounded-full opacity-60" />
                            </div>
                          )}
                        </div>

                        {tech.short_description && (
                          <p className="text-base md:text-lg leading-relaxed text-[#555] font-medium opacity-90 line-clamp-4">
                            {tech.short_description}
                          </p>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Call to Action Profissional */}
        <section className="bg-white py-24 md:py-32 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF8A00]/5 rounded-full -mr-32 -mt-32" />
           <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#213754]/5 rounded-full -ml-48 -mb-48" />
           
          <div className="container mx-auto px-4 text-center relative z-10">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-[#213754] tracking-tight">
              PRECISA DE UMA <span className="text-[#FF8A00]">SOLUÇÃO</span> TÉCNICA?
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-xl text-[#555] font-medium">
              Nosso laboratório está pronto para desenvolver a malha ideal para a sua necessidade, unindo tecnologia, design e sustentabilidade.
            </p>
            <div className="mt-12">
              <Button asChild size="lg" className="rounded-full bg-[#213754] px-10 py-7 text-lg hover:bg-[#213754]/90 shadow-xl hover:shadow-2xl transition-all duration-300">
                <a
                  href={whatsappLink("Olá! Gostaria de falar com um especialista sobre as tecnologias da Digitale Têxtil.")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  FALAR COM UM ESPECIALISTA
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl w-[95vw] md:w-full max-h-[90vh] overflow-y-auto rounded-[2rem] md:rounded-[3rem] p-0 border-none shadow-2xl overflow-x-hidden">
          <div className="relative">
            {selected?.image_url ? (
              <div className="h-48 md:h-80 w-full overflow-hidden">
                <img
                  src={selected.image_url}
                  alt={`Tecnologia ${selected.name}`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent" />
              </div>
            ) : (
              <div className="h-40 bg-[#213754]" />
            )}
            
            <div className="px-6 md:px-12 pb-10 md:pb-12 pt-4 md:pt-6 bg-white relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="flex-1">
                  <h2 className="font-display text-2xl md:text-4xl font-bold text-[#213754] uppercase tracking-tight leading-tight">
                    {selected?.name}
                  </h2>
                  <div className="h-1 w-16 md:w-20 bg-[#FF8A00] mt-2 md:mt-3 rounded-full" />
                </div>
                
                {selected && (
                   <div className={cn("h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-full flex items-center justify-center p-0 overflow-hidden shadow-lg bg-white", (!selected.icon_url && !badgeMap[selected.name.toUpperCase()]) && getTechStyles(selected.name))}>
                      {selected.icon_url ? (
                        <img 
                          src={selected.icon_url} 
                          alt={selected.name}
                          className="h-full w-full object-contain"
                        />
                      ) : badgeMap[selected.name.toUpperCase()] ? (
                        <img 
                          src={badgeMap[selected.name.toUpperCase()]} 
                          alt={selected.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <SelectedIcon className="h-6 w-6 md:h-8 md:w-8" />
                      )}
                   </div>
                )}
              </div>

              <div className="space-y-6 md:space-y-8">
                {selected?.description && (
                  <div>
                    <h3 className="text-[10px] md:text-sm font-bold text-[#FF8A00] uppercase tracking-widest mb-2 md:mb-3">Sobre a Tecnologia</h3>
                    <p className="text-base md:text-lg leading-relaxed text-[#555] font-medium">
                      {selected.description}
                    </p>
                  </div>
                )}

                {!!selected?.benefits.length && (
                  <div>
                    <h3 className="text-[10px] md:text-sm font-bold text-[#FF8A00] uppercase tracking-widest mb-3 md:mb-4">Principais Diferenciais</h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-x-8 md:gap-y-4">
                      {selected.benefits.map((b) => (
                        <li key={b} className="flex items-center gap-3 md:gap-4 text-sm md:text-base text-[#555] font-semibold bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl">
                          <div className="h-1.5 w-1.5 md:h-2 md:w-2 shrink-0 rounded-full bg-[#FF8A00]" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!!selected?.applications.length && (
                  <div>
                    <h3 className="text-[10px] md:text-sm font-bold text-[#FF8A00] uppercase tracking-widest mb-3 md:mb-4">Segmentos de Aplicação</h3>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      {selected.applications.map((a) => (
                        <Badge key={a} variant="outline" className="rounded-full border-[#213754] text-[#213754] px-4 md:px-6 py-1 md:py-2 text-[10px] md:text-sm font-bold hover:bg-[#213754] hover:text-white transition-colors">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-6">
                  <Button asChild className="w-full rounded-full bg-[#FF8A00] py-8 text-xl font-bold hover:bg-[#FF8A00]/90 shadow-xl">
                    <a
                      href={whatsappLink(`Tenho interesse na tecnologia ${selected?.name} para meus produtos.`)}
                      onClick={() => {
                        void trackEvent("whatsapp_click", {
                          entityType: "technology",
                          entitySlug: selected?.slug || selected?.name,
                          metadata: { placement: "technology_sample" },
                        });
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      SOLICITAR AMOSTRAS
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Technologies;