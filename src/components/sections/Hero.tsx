import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
    const timer = setInterval(nextSlide, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, nextSlide, slides.length]);

  useEffect(() => {
    if (slides.length > 0 && currentSlide >= slides.length) {
      setCurrentSlide(0);
    }
  }, [slides.length, currentSlide]);

  if (isLoading || slides.length === 0) {
    return null;
  }

  return (
    <section
      className="relative w-full overflow-hidden bg-muted"
      style={{ 
        maxWidth: "1900px",
        margin: "0 auto"
      }}
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Responsive wrapper that maintains 1900:500 aspect ratio */}
      <div 
        className="relative w-full"
        style={{ 
          paddingBottom: "26.32%",
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
                className="w-full h-full object-cover"
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
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all z-20 shadow-md"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all z-20 shadow-md"
              aria-label="Próximo slide"
            >
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6 text-foreground" />
            </button>
          </>
        )}

        {/* Dots Navigation */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
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
          <div className="absolute bottom-0 left-0 h-0.5 bg-accent z-20 progress-bar" key={currentSlide} />
        )}
      </div>

      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
        .progress-bar {
          animation: progressBar 5s linear;
        }
      `}</style>
    </section>
  );
}
