import { FabricCommercialSEO } from "@/components/fabric/FabricCommercialSEO";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { JsonLd, buildBreadcrumbJsonLd } from "@/components/JsonLd";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Phone, Mail, ArrowRight, Heart } from "lucide-react";
import { isVideoUrl } from "@/lib/media-utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorGallery } from "@/components/fabric/ColorGallery";
import { FabricGallery } from "@/components/fabric/FabricGallery";
import { FavoriteButton } from "@/components/fabric/FavoriteButton";
import { FabricLeadForm } from "@/components/fabric/FabricLeadForm";
import fabricMilano from "@/assets/fabric-milano.jpg";
import fabricLyon from "@/assets/fabric-lyon.jpg";
import fabricAerodry from "@/assets/fabric-aerodry.jpg";
import fabricVeneza from "@/assets/fabric-veneza.jpg";

const defaultImages: Record<string, string> = {
  milano: fabricMilano,
  lyon: fabricLyon,
  aerodry: fabricAerodry,
  veneza: fabricVeneza,
};

interface ColorVariant {
  name: string;
  hex: string;
}

interface GalleryImage {
  url: string;
  alt?: string;
}

export default function FabricDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useLanguage();
  const { whatsappNumber } = useSiteSettings();

  const formatPhone = (num: string) => {
    if (num.length === 13) return `+${num.slice(0,2)} ${num.slice(2,4)} ${num.slice(4,9)}-${num.slice(9)}`;
    if (num.length === 12) return `+${num.slice(0,2)} ${num.slice(2,4)} ${num.slice(4,8)}-${num.slice(8)}`;
    return num;
  };

  const { data: fabric, isLoading, error } = useQuery({
    queryKey: ["fabric", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrics")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: fabricCategoryData } = useQuery({
    queryKey: ["fabric-category", (fabric as any)?.category_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("fabric_categories")
        .select("name, slug")
        .eq("id", (fabric as any).category_id)
        .maybeSingle();
      return data;
    },
    enabled: !!(fabric as any)?.category_id,
  });

  const { data: otherFabrics } = useQuery({
    queryKey: ["other-fabrics", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrics")
        .select("*")
        .eq("is_active", true)
        .neq("slug", slug)
        .order("display_order")
        .limit(3);

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-6 py-16">
            <Skeleton className="h-8 w-48 mb-8" />
            <div className="grid lg:grid-cols-2 gap-12">
              <Skeleton className="aspect-square rounded-2xl" />
              <div className="space-y-4">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            </div>
          </div>
        </main>

      <Footer />
      </div>
    );
  }

  if (error || !fabric) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-6 py-32 text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">Tecido não encontrado</h1>
            <p className="text-muted-foreground mb-8">O tecido que você procura não está disponível.</p>
            <Link to="/tecidos" className="btn-primary inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Ver todos os tecidos
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const features = Array.isArray(fabric.features) ? fabric.features : [];
  const specifications = fabric.specifications as Record<string, string> || {};
  const applications = fabric.applications || [];
  const colorVariants = Array.isArray(fabric.color_variants)
    ? (fabric.color_variants as unknown as ColorVariant[])
    : [];
  const galleryImages = Array.isArray(fabric.gallery_images)
    ? (fabric.gallery_images as unknown as GalleryImage[])
    : [];
  const imageUrl = fabric.image_url || defaultImages[fabric.slug] || fabricMilano;
  const fabricCategory = fabricCategoryData as { name?: string; slug?: string } | null;
  const categoryName = fabricCategory?.name || "Tecidos Técnicos";
  const categorySlug = fabricCategory?.slug;
  const fabricUrl = `https://digitaletextil.com.br/tecidos/${fabric.slug}`;
  const priceField = (fabric as any).price as number | string | null | undefined;
  const hasPrice = priceField !== null && priceField !== undefined && priceField !== "";

  return (
    <div className="min-h-screen">
      <Header />
      <SEO
        title={fabric.slug === "aerodry"
          ? "Tecido Aerodry: características e aplicações"
          : `Tecido ${fabric.name} – Ficha Técnica e Composição`}
        description={`${fabric.name}: ${(fabric.short_description || fabric.description || "tecido técnico Digitale Têxtil com alta performance").toString().slice(0, 150)}`}
        keywords={`tecido ${fabric.name}, malha ${fabric.name}, ${fabric.name} digitale, ficha técnica ${fabric.name}, comprar tecido ${fabric.name}`}
        image={fabric.image_url || undefined}
      />
      <JsonLd
        id={`product-${fabric.slug}`}
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: `Tecido ${fabric.name}`,
          description: (fabric.short_description || fabric.description || `Tecido ${fabric.name} Digitale Têxtil`).toString().slice(0, 300),
          image: imageUrl,
          sku: fabric.slug,
          mpn: fabric.slug,
          category: categoryName,
          brand: { "@type": "Brand", name: "Digitale Têxtil" },
          manufacturer: {
            "@type": "Organization",
            name: "Digitale Têxtil",
            url: "https://digitaletextil.com.br",
          },
          url: fabricUrl,
          offers: {
            "@type": "Offer",
            url: fabricUrl,
            priceCurrency: "BRL",
            ...(hasPrice
              ? { price: String(priceField) }
              : { priceSpecification: { "@type": "PriceSpecification", priceCurrency: "BRL", valueAddedTaxIncluded: true } }),
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@type": "Organization", name: "Digitale Têxtil" },
            businessFunction: "https://schema.org/Sell",
            eligibleCustomerType: "https://schema.org/Business",
          },
        }}
      />
      <JsonLd
        id={`breadcrumb-fabric-${fabric.slug}`}
        data={buildBreadcrumbJsonLd([
          { name: "Home", url: "https://digitaletextil.com.br/" },
          { name: "Tecidos", url: "https://digitaletextil.com.br/tecidos" },
          { name: fabric.name, url: fabricUrl },
        ])}
      />
      <main className="pt-20">
        {/* Breadcrumb */}
        <div className="bg-secondary/30 border-b border-border">
          <div className="container mx-auto px-6 py-4">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-accent">Home</Link>
              <span>/</span>
              <Link to="/tecidos" className="hover:text-accent">Tecidos</Link>
              <span>/</span>
              <span className="text-foreground font-medium">{fabric.name}</span>
            </nav>
          </div>
        </div>

        {/* Product Detail */}
        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Image Gallery */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <FabricGallery
                  mainImage={imageUrl}
                  images={galleryImages}
                  fabricName={fabric.name}
                />
              </motion.div>

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="section-subtitle">{t("products.label")}</span>
                      <h1 className="text-4xl md:text-5xl font-bold text-foreground mt-2 mb-4">
                        {fabric.name}
                      </h1>
                    </div>
                    <FavoriteButton
                      fabric={fabric}
                      size="lg"
                    />
                  </div>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {fabric.description || fabric.short_description}
                  </p>
                </div>

                {/* Color Gallery */}
                {colorVariants.length > 0 && (
                  <ColorGallery colors={colorVariants} />
                )}


                {/* FABRIC_TECHNICAL_CONTENT_V1 */}
                <section
                  aria-labelledby="fabric-technical-title"
                  className="hidden md:block space-y-5"
                >
                  <h2 id="fabric-technical-title" className="text-2xl font-bold">
                    Características e ficha técnica do tecido {fabric.name}
                  </h2>

                  {Object.keys(specifications).length > 0 && (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(specifications).map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-border p-4">
                          <dt className="text-sm text-muted-foreground">{label}</dt>
                          <dd className="mt-1 font-medium">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {features.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold">Características cadastradas</h3>
                      <ul className="mt-3 list-disc pl-5 space-y-2">
                        {features.map((feature, index) => (
                          <li key={index}>{String(feature)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(applications) && applications.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold">
                        Para que serve o tecido {fabric.name}?
                      </h3>
                      <ul className="mt-3 list-disc pl-5 space-y-2">
                        {applications.map((application, index) => (
                          <li key={index}>{String(application)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {fabric.slug === "aerodry" && (
                    <div className="rounded-xl border border-border p-5 space-y-3">
                      <h3 className="text-lg font-semibold">Tecido Aerodry é bom para minha peça?</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Compare a ficha técnica e as aplicações cadastradas nesta página
                        com as necessidades da sua confecção. Para avaliar o resultado
                        na sua peça, solicite uma amostra e orientação da equipe comercial.
                      </p>
                    </div>
                  )}
                </section>

                {/* DIGITALE_MOBILE_TECHNICAL_HIDDEN_V1 */}
                {/* Formulário técnico permanece somente no desktop */}
                <div className="hidden md:block">
                  <FabricLeadForm
                  fabricId={fabric.id}
                  fabricName={fabric.name}
                  fabricSlug={fabric.slug}
                  />
                </div>

                {/* CTA */}
                <div className="pt-4 space-y-4">
                  
                  {/* DIGITALE_FABRIC_WHATSAPP_MOBILE_V1 */}
                  {/* DIGITALE_FABRIC_REMOVE_EXTRA_CONTACT_MOBILE_V1 */}

                  <a
                    href="https://wa.me/5511973715327?text=Ol%C3%A1%21%20Gostaria%20de%20saber%20mais%20sobre%20os%20tecidos%20da%20Digitale."
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Chamar a Digitale no WhatsApp"
                    className="md:hidden w-full min-h-[54px] rounded-xl bg-[#25D366] text-white flex items-center justify-center gap-3 px-5 py-3 text-[16px] font-semibold shadow-md hover:bg-[#1ebe5d] active:scale-[0.98] transition-all"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-6 h-6 shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.966-.273-.099-.471-.148-.67.15-.198.297-.768.965-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51l-.57-.01c-.198 0-.52.074-.792.372-.273.297-1.04 1.015-1.04 2.478s1.064 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.261.489 1.692.626.711.226 1.359.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347M12.004 2a9.935 9.935 0 0 0-8.573 14.97L2 22l5.172-1.355A9.95 9.95 0 0 0 12.004 22C17.526 22 22 17.523 22 12S17.526 2 12.004 2m0 18.18a8.172 8.172 0 0 1-4.162-1.14l-.299-.178-3.086.81.824-3.008-.195-.309A8.172 8.172 0 0 1 3.82 12c0-4.514 3.671-8.185 8.184-8.185 4.514 0 8.185 3.671 8.185 8.185 0 4.514-3.671 8.185-8.185 8.185"/>
                    </svg>

                    <span>Chamar no WhatsApp</span>
                  </a>

                  <Link
                    to="/contato"
                    className="hidden md:block btn-primary w-full text-center"
                  >
                    {t("cta.button")}
                  </Link>
                  <div className="hidden md:flex flex-col md:flex-row gap-4 text-sm text-muted-foreground">
                    <a href={`tel:+${whatsappNumber}`} className="flex items-center gap-2 hover:text-accent">
                      <Phone className="h-4 w-4" />
                      {formatPhone(whatsappNumber)}
                    </a>
                    <a href="mailto:atendimento@digitaletextil.com.br" className="flex items-center gap-2 hover:text-accent">
                      <Mail className="h-4 w-4" />
                      atendimento@digitaletextil.com.br
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Other Fabrics */}
        {otherFabrics && otherFabrics.length > 0 && (
          <section className="py-16 bg-secondary/30">
            <div className="container mx-auto px-6">
              <h2 className="text-2xl font-bold text-foreground mb-8">Outros Tecidos</h2>
              <div className="grid md:grid-cols-3 gap-8">
                {otherFabrics.map((otherFabric) => (
                  <Link
                    key={otherFabric.id}
                    to={`/tecidos/${otherFabric.slug}`}
                    className="group block bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
                  >
                    <div className="aspect-video overflow-hidden">
                      {isVideoUrl(otherFabric.image_url || defaultImages[otherFabric.slug] || fabricMilano) ? (
                        <video
                          src={otherFabric.image_url || defaultImages[otherFabric.slug] || fabricMilano}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          muted loop autoPlay playsInline
                        />
                      ) : (
                        <img
                          src={otherFabric.image_url || defaultImages[otherFabric.slug] || fabricMilano}
                          alt={otherFabric.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      )}
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-foreground group-hover:text-accent transition-colors">
                        {otherFabric.name}
                      </h3>
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
                        {otherFabric.short_description}
                      </p>
                      <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm mt-4">
                        Ver detalhes
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
