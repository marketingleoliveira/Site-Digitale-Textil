import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MobilePanoramicHero } from "./MobilePanoramicHero";
// DIGITALE_MOBILE_PANORAMA_CIRCULAR_V1
import { MobileHero } from "./MobileHero";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroBg from "@/assets/hero-bg.jpg";
import athleteModel from "@/assets/athlete-model.jpg";

// Fallback slides when no database slides exist
const fallbackSlides = [
  { id: "1", image_url: heroBg, alt_text: "Digitale Têxtil" },
  { id: "2", image_url: athleteModel, alt_text: "Linha Fitness" },
];

export function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // DIGITALE_MOBILE_IDLE_10S_V1
  const mobileLastInteractionRef = useRef(Date.now());
  const mobileTouchActiveRef = useRef(false);
  const lastAutoAdvanceRef = useRef(Date.now());

  const mobileInteractionStart = useCallback(() => {
    mobileTouchActiveRef.current = true;
    mobileLastInteractionRef.current = Date.now();
    lastAutoAdvanceRef.current = Date.now();
  }, []);

  const mobileInteractionEnd = useCallback(() => {
    mobileTouchActiveRef.current = false;
    mobileLastInteractionRef.current = Date.now();
    lastAutoAdvanceRef.current = Date.now();
  }, []);


  const { data: dbSlides, isLoading } = useQuery({
    queryKey: ["carousel-slides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_slides")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: true,
    staleTime: 1000 * 60 * 2,
  });

  const slides = isLoading ? [] : (dbSlides && dbSlides.length > 0 ? dbSlides : fallbackSlides);

  const nextSlide = useCallback(() => {
    if (slides.length === 0 || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [slides.length, isTransitioning]);

  const prevSlide = useCallback(() => {
    if (slides.length === 0 || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [slides.length, isTransitioning]);


  useEffect(() => {
    if (!isAutoPlaying || slides.length <= 1) return;

    const timer = window.setInterval(() => {
      const now = Date.now();

      const isMobile = window.matchMedia(
        "(max-width: 767px)"
      ).matches;

      if (isTransitioning) return;

      if (isMobile) {
        // Nunca trocar enquanto o usuário toca ou arrasta.
        if (mobileTouchActiveRef.current) return;

        // Exigir dez segundos completos sem interação.
        if (
          now - mobileLastInteractionRef.current < 3000
        ) return;

        // Manter dez segundos entre trocas automáticas.
        if (
          now - lastAutoAdvanceRef.current < 3000
        ) return;
      } else {
        // Comportamento original do desktop.
        if (
          now - lastAutoAdvanceRef.current < 5000
        ) return;
      }

      lastAutoAdvanceRef.current = now;
      nextSlide();
    }, 250);

    return () => window.clearInterval(timer);
  }, [
    isAutoPlaying,
    nextSlide,
    slides.length,
    isTransitioning,
  ]);


  useEffect(() => {
    if (slides.length > 0 && currentSlide >= slides.length) {
      setCurrentSlide(0);
    }
  }, [slides.length, currentSlide]);

  if (isLoading || slides.length === 0) {
    return null;
  }

  return (
    <>
      <MobilePanoramicHero slides={slides} />
      <section
      className="hidden md:block relative w-full overflow-hidden bg-muted"
      style={{ 
        maxWidth: "1900px",
        margin: "0 auto"
      }}
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Responsive wrapper that maintains 1900:500 aspect ratio */}
      <div
        className="digitale-hero-stage relative w-full hidden md:block"
        style={{
          aspectRatio: "1900 / 500",
          maxHeight: "500px"
        }}
      >
        {/* Carousel Container - Simple fade transition */}
        <div className="absolute inset-0">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
                index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={slide.image_url}
                alt={slide.alt_text || "Slide"}
                className="digitale-hero-image w-full h-full object-contain"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
              />
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-8 h-8 md:w-12 md:h-12 bg-white/90 hover:bg-white rounded-full hidden md:flex items-center justify-center transition-all z-20 shadow-md"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="h-4 w-4 md:h-6 md:w-6 text-foreground" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-8 h-8 md:w-12 md:h-12 bg-white/90 hover:bg-white rounded-full hidden md:flex items-center justify-center transition-all z-20 shadow-md"
              aria-label="Próximo slide"
            >
              <ChevronRight className="h-4 w-4 md:h-6 md:w-6 text-foreground" />
            </button>
          </>
        )}

        {/* DIGITALE_HIDE_MOBILE_PAGINATION_V1 */}
        {/* Dots Navigation */}
        {slides.length > 1 && (
          <div className="hidden md:flex absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 gap-2 z-20">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!isTransitioning) {
                    setIsTransitioning(true);
                    setCurrentSlide(index);
                    setTimeout(() => setIsTransitioning(false), 500);
                  }
                }}
                className={`rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? "bg-accent w-6 md:w-8 h-2"
                    : "bg-white/70 hover:bg-white w-2 h-2"
                }`}
                aria-label={`Ir para slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Progress bar */}
        {slides.length > 1 && isAutoPlaying && (
          <div className="hidden md:block absolute bottom-0 left-0 h-0.5 bg-accent z-20 progress-bar" key={currentSlide} />
        )}
      </div>


      {/* DIGITALE_MOBILE_PAN_VERTICAL_V1 */}
      <MobileHero
        key={slides[currentSlide].id}
        imageUrl={slides[currentSlide].image_url}
        altText={slides[currentSlide].alt_text || "Banner Digitale"}
        onNext={nextSlide}
        onPrevious={prevSlide}
        onInteractionStart={mobileInteractionStart}
        onInteractionEnd={mobileInteractionEnd}
      />

      <style>{`

        /* DIGITALE_HERO_MOBILE_V2 */
        @media (max-width: 767px) {
          .digitale-hero-stage {
            aspect-ratio: 1900 / 500 !important;
            height: auto !important;
            max-height: none !important;
            padding-bottom: 0 !important;
            background: transparent !important;
          }

          .digitale-hero-stage .digitale-hero-image {
            position: relative;
            z-index: 1;
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: center center;
            background: transparent;
          }
        }

        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
        .progress-bar {
          animation: progressBar 5s linear;
        }
      `}</style>
    </section>
    </>
  );
}
