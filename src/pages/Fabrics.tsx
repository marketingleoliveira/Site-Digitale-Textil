import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChevronDown, Heart, Eye, Play, Dumbbell, Sun } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isVideoUrl } from "@/lib/media-utils";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/fabric/FavoriteButton";
import { FavoritesDrawer } from "@/components/fabric/FavoritesDrawer";
import { FabricSkeletonGrid } from "@/components/fabric/FabricSkeleton";
import { FavoritesProvider, useFavorites } from "@/contexts/FavoritesContext";
import { FabricDetailModal } from "@/components/fabric/FabricDetailModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import badgeAloeVera from "@/assets/tech-badges/aloe-vera.webp";
import badgeUV50 from "@/assets/tech-badges/uv50.webp";
import badgeAntibacteriano from "@/assets/tech-badges/antibacteriano.webp";
import badgeSuperBlack from "@/assets/tech-badges/super-black.webp";
import badge4WayStretch from "@/assets/tech-badges/4-way-stretch.webp";
import badgeZeroTransparencia from "@/assets/tech-badges/zero-transparencia.webp";
import badgeCreora from "@/assets/tech-badges/creora.png";
import badgeSuperMicroFibra from "@/assets/tech-badges/super-micro-fibra.webp";
import badgeEstampariaHD from "@/assets/tech-badges/super-brilho.png";
import techBadgesReal from "@/assets/tech-badges-real.png.asset.json";

const techDescriptions: Record<string, string> = {
  "Aloe Vera": "Tecnologia que incorpora microcápsulas de Aloe Vera na fibra do tecido, proporcionando hidratação e suavidade ao contato com a pele, além de propriedades calmantes e anti-irritação.",
  "Proteção UV 50+": "Proteção ultravioleta fator 50+, bloqueando mais de 98% dos raios UVA e UVB. Certificação permanente que não diminui com as lavagens, garantindo segurança durante atividades ao ar livre.",
  "Antibacteriana": "Tratamento antibacteriano permanente que inibe a proliferação de bactérias causadoras de mau odor, mantendo o tecido fresco e higiênico por mais tempo.",
  "Super Black": "Tecnologia exclusiva de tingimento que garante um preto ultra intenso e duradouro, com alta resistência à perda de cor mesmo após múltiplas lavagens.",
  "4 Way Stretch": "Elasticidade multidirecional (4 vias) que permite total liberdade de movimento em qualquer direção, oferecendo conforto superior e perfeito caimento ao corpo.",
  "Zero Transparência": "Tecido com construção especial que elimina a transparência mesmo em cores claras, garantindo segurança e confiança durante qualquer atividade física.",
  "Creora": "Fio de elastano premium da marca Creora®, reconhecido mundialmente por sua elasticidade superior, excelente recuperação e durabilidade, proporcionando ajuste perfeito ao corpo.",
  "Super Microfibra": "Tecido produzido com fios de microfibra ultrafinos, resultando em toque extremamente macio, leveza e alta capacidade de absorção e secagem rápida.",
  "Estamparia Digital HD": "Tecnologia de estamparia digital de alta definição que garante cores vibrantes, nitidez excepcional nos detalhes e durabilidade superior, permitindo infinitas possibilidades de cores e desenhos.",
};

const techBadgesByCategory: Record<string, { name: string; image: string }[]> = {
  "fitness": [
    { name: "Aloe Vera", image: badgeAloeVera },
    { name: "Proteção UV 50+", image: badgeUV50 },
    { name: "Antibacteriana", image: badgeAntibacteriano },
    { name: "Super Black", image: badgeSuperBlack },
    { name: "4 Way Stretch", image: badge4WayStretch },
    { name: "Zero Transparência", image: badgeZeroTransparencia },
  ],
  "praia": [
    { name: "Aloe Vera", image: badgeAloeVera },
    { name: "Proteção UV 50+", image: badgeUV50 },
    { name: "Creora", image: badgeCreora },
    { name: "Super Microfibra", image: badgeSuperMicroFibra },
    { name: "Antibacteriana", image: badgeAntibacteriano },
    { name: "Estamparia Digital HD", image: badgeEstampariaHD },
  ],
};

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
  caribe: fabricCaribe
};

function FabricsContent() {
  const { t } = useLanguage();
  const { isFavorite } = useFavorites();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selectedFabric, setSelectedFabric] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<{ name: string; image: string } | null>(null);

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["fabric-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("fabric_categories").
      select("*").
      eq("is_active", true).
      order("display_order");

      if (error) throw error;
      return data;
    }
  });

  // Fetch fabrics
  const { data: fabrics, isLoading: fabricsLoading } = useQuery({
    queryKey: ["fabrics-with-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("fabrics").
      select("*, fabric_category_assignments(category_id)").
      eq("is_active", true).
      order("display_order");

      if (error) throw error;
      return data;
    }
  });

  // Auto-expand all categories on load
  useEffect(() => {
    if (categories) {
      setExpandedCategories(categories.map((c) => c.id));
    }
  }, [categories]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
    prev.includes(categoryId) ?
    prev.filter((id) => id !== categoryId) :
    [...prev, categoryId]
    );
  };

  const handleFabricClick = (fabric: any) => {
    setSelectedFabric(fabric);
    setModalOpen(true);
  };

  // Group fabrics by category
  const fabricsByCategory = useMemo(() => {
    if (!fabrics || !categories) return new Map();

    const grouped = new Map<string, typeof fabrics>();

    categories.forEach((category) => {
      const categoryFabrics = fabrics.filter((f: any) =>
        Array.isArray(f.fabric_category_assignments) &&
        f.fabric_category_assignments.some(
          (a: any) =>
            String(a.category_id) === String(category.id)
        )
      );

      if (categoryFabrics.length > 0) {
        grouped.set(category.id, categoryFabrics);
      }
    });

    return grouped;
  }, [fabrics, categories]);

  const isLoading = categoriesLoading || fabricsLoading;

  return (
    <div className="min-h-screen">
      <Header />
      <SEO title="Tecidos Fitness, Moda Praia e Malhas Técnicas" description="Catálogo completo de tecidos fitness, moda praia e malhas técnicas com proteção UV 50+, Aloe Vera, antibacteriano e linha ECO sustentável." keywords="catálogo de tecidos, tecido fitness, tecido moda praia, malha UV 50, tecido aloe vera, tecido antibacteriano, tecido eco sustentável, malha suplex, malha emana" />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-16 bg-primary text-white">
          <div className="container mx-auto px-6 text-center">
            

            
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              Nossos Tecidos
            </h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto mb-4">
              Conheça nossa linha completa de tecidos de alta performance para moda esportiva e fitness.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/80 text-sm animate-pulse cursor-default">
              <Eye className="h-4 w-4 animate-bounce" />
              <span>Clique nos tecidos para ver detalhes completos</span>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-16">
          <div className="container mx-auto px-6">
            {isLoading ?
            <FabricSkeletonGrid count={6} /> :
            categories && categories.length > 0 ?
            <div className="space-y-8">
                {categories.map((category) => {
                const categoryFabrics = fabricsByCategory.get(category.id) || [];
                const isExpanded = expandedCategories.includes(category.id);

                return (
                  <div key={category.id}>
                      <Collapsible
                      open={isExpanded}
                      onOpenChange={() => toggleCategory(category.id)}>
                      
                        <CollapsibleTrigger asChild>
                          <button className="w-full flex flex-col md:flex-row items-center justify-between p-5 bg-card rounded-xl border border-border hover:border-accent/30 transition-all group gap-4">
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#FF5C00] flex items-center justify-center text-white">
                                {category.slug?.toLowerCase() === 'fitness' ? (
                                  <Dumbbell className="h-6 w-6" />
                                ) : category.slug?.toLowerCase() === 'praia' ? (
                                  <Sun className="h-6 w-6" />
                                ) : (
                                  <span className="font-bold text-lg">{category.name.charAt(0)}</span>
                                )}
                              </div>
                              <div className="text-left">
                                <h2 className="text-xl md:text-2xl font-bold text-foreground group-hover:text-accent transition-colors">
                                  {category.name}
                                </h2>
                                {category.description &&
                              <p className="text-muted-foreground text-sm mt-1">
                                    {category.description}
                                  </p>
                              }
                              </div>
                            </div>
                            
                            {/* Tech Badges - centered */}
                            {(() => {
                              const slug = category.slug?.toLowerCase();
                              const badges = techBadgesByCategory[slug];
                              if (!badges) return <div className="flex-1" />;
                              return (
                                <div className="flex-1 flex justify-center">
                                <div className="flex flex-wrap justify-center gap-4">
                                    {badges.map((badge) => (
                                      <button
                                        key={badge.name}
                                        onClick={(e) => { e.stopPropagation(); setSelectedTech(badge); }}
                                        className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-sm flex items-center justify-center p-1.5 hover:shadow-md hover:scale-110 transition-all cursor-pointer"
                                        title={badge.name}
                                      >
                                        <img src={badge.image} alt={badge.name} className="w-full h-full object-contain" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                                {categoryFabrics.length} tecido{categoryFabrics.length !== 1 ? 's' : ''}
                              </span>
                              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
                            {categoryFabrics.map((fabric) =>
                          <div
                            key={fabric.id}
                            className="group relative">
                            
                                <Button
                              variant="outline"
                              className="w-full h-auto flex flex-col items-stretch p-0 overflow-hidden border-2 hover:border-accent transition-all"
                              onClick={() => handleFabricClick(fabric)}>
                              
                                  {/* Image/Video preview */}
                                  <div className="aspect-[4/3] overflow-hidden relative">
                                    {isVideoUrl(fabric.image_url || defaultImages[fabric.slug] || '') ? (
                                      <>
                                        <video
                                          src={fabric.image_url || defaultImages[fabric.slug] || fabricMilano}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                          muted
                                          playsInline
                                          preload="metadata"
                                        />
                                      </>
                                    ) : (
                                    <img
                                  src={fabric.image_url || defaultImages[fabric.slug] || fabricMilano}
                                  alt={fabric.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy" />
                                    )}
                                
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye className="h-5 w-5 text-white" />
                                    </div>
                                    
                                    {/* Favorite indicator */}
                                    {isFavorite(fabric.id) &&
                                <div className="absolute top-2 left-2">
                                        <div className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center shadow">
                                          <Heart className="h-3 w-3 text-white fill-white" />
                                        </div>
                                      </div>
                                }
                                  </div>
                                  
                                  {/* Fabric name */}
                                  <div className="p-3 text-left bg-card">
                                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                                      {fabric.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                      {fabric.short_description}
                                    </p>
                                  </div>
                                </Button>
                                
                                {/* Quick favorite button */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <FavoriteButton
                                fabric={fabric}
                                size="sm" />
                              
                                </div>
                              </div>
                          )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>);

              })}
              </div> :

            <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">
                  Nenhuma categoria de tecido encontrada.
                </p>
              </div>
            }
          </div>
        </section>
      </main>
      <Footer />
      
      {/* Fabric Detail Modal */}
      <FabricDetailModal
        fabric={selectedFabric}
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultImages={defaultImages}
        fallbackImage={fabricMilano} />
      
      {/* Tech Badge Popup */}
      <Dialog open={!!selectedTech} onOpenChange={(open) => !open && setSelectedTech(null)}>
        <DialogContent className="max-w-sm">
          {selectedTech && (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center p-3">
                    <img src={selectedTech.image} alt={selectedTech.name} className="w-full h-full object-contain" />
                  </div>
                  <DialogTitle className="text-xl font-bold text-center">{selectedTech.name}</DialogTitle>
                </div>
              </DialogHeader>
              <p className="text-muted-foreground text-sm text-center leading-relaxed mt-2">
                {techDescriptions[selectedTech.name] || "Tecnologia de alta performance para tecidos esportivos."}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      
      <FavoritesDrawer defaultImages={defaultImages} />
    </div>);

}

const Fabrics = () => {
  return (
    <FavoritesProvider>
      <FabricsContent />
    </FavoritesProvider>);

};

export default Fabrics;