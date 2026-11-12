import { useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import aloeVera from "@/assets/tech-badges/aloe-vera.webp";
import uv50 from "@/assets/tech-badges/uv50.webp";
import superBlack from "@/assets/tech-badges/super-black.webp";

const technologies = [
  { name: "Aloe Vera", image: aloeVera },
  { name: "Proteção UV 50+", image: uv50 },
  { name: "SuperBlack", image: superBlack },
  { name: "Estamparia Digital HD", image: "/uploads/original-live/uploads/technologies/1786565946593-hs1lqd.png" },
];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const list = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) {
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; }
    catch { return value.split("\n").filter(Boolean); }
  }
  return [];
};
type Technology = typeof technologies[number];
function TechnologyBadge({ technology, large = false }: { technology: Technology; large?: boolean }) {
  return (
    <span className={large ? "block w-28 h-28 sm:w-36 sm:h-36 shrink-0 rounded-full overflow-hidden" : "block w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden"}>
      <img src={technology.image} alt={technology.name} draggable={false} onDragStart={(event) => event.preventDefault()} width={128} height={128} loading={large ? "eager" : "lazy"} className="w-full h-full object-contain" style={technology.name === "Estamparia Digital HD" ? { transform: "scale(1.27)", transformOrigin: "50% 50%" } : undefined} />
    </span>
  );
}
export function HomeTechnologies() {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<Technology | null>(null);

  const gesture = useRef({ x: 0, y: 0, moved: false, active: false });
  const autoScroll = useMemo(() => AutoScroll({
    speed: 0.45, startDelay: 0, playOnInit: false,
    stopOnInteraction: true, stopOnFocusIn: false,
  }), []);
  const [carouselRef, carouselApi] = useEmblaCarousel({
    align: "start", loop: true, dragFree: true,
    breakpoints: { "(min-width: 768px)": { active: false } },
  }, [autoScroll]);
  useEffect(() => {
    if (!carouselApi) return;
    let visible = false;
    let dragging = false;
    let timer = 0;
    const root = carouselApi.rootNode();
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => {
      if (reduceMotion || selected || !visible || dragging || document.hidden || media.matches) autoScroll.stop();
      else autoScroll.play();
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.3 });
    observer.observe(root);
    const down = () => { dragging = true; window.clearTimeout(timer); autoScroll.stop(); };
    const up = () => { dragging = false; timer = window.setTimeout(sync, 800); };
    carouselApi.on("pointerDown", down).on("pointerUp", up).on("reInit", sync);
    document.addEventListener("visibilitychange", sync);
    media.addEventListener("change", sync);
    return () => {
      window.clearTimeout(timer); observer.disconnect(); autoScroll.stop();
      carouselApi.off("pointerDown", down).off("pointerUp", up).off("reInit", sync);
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
    };
  }, [carouselApi, autoScroll, reduceMotion, selected]);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["home-technology-details"],
    enabled: !!selected,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase.from("technologies").select("id, name, short_description, description, benefits, applications").eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });
  const details = selected ? data.find((item) => normalize(item.name) === normalize(selected.name)) : null;
  const benefits = list(details?.benefits);
  const applications = list(details?.applications);
  return (
    <section data-digitale-home-technologies="true" aria-labelledby="home-technologies-title" className="bg-secondary/30 pt-12 pb-4 md:pt-16 md:pb-6">
      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6">
        <motion.h2 id="home-technologies-title" initial={reduceMotion ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6 }} className="section-title text-center mb-8 md:mb-10">Tecnologia que você sente.</motion.h2>
        <div ref={carouselRef} className="digitale-technologies-viewport overflow-hidden max-w-3xl mx-auto pt-3 pb-10" style={{ touchAction: "pan-y pinch-zoom", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
          onPointerDownCapture={(event) => { autoScroll.stop(); gesture.current = { x: event.clientX, y: event.clientY, moved: false, active: true }; }}
          onPointerUpCapture={(event) => {
            const current = gesture.current;
            if (!current.active) return;
            current.active = false;
            if (current.moved || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) return;
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-technology]");
            const technology = technologies.find((item) => item.name === button?.dataset.technology);
            if (technology) { autoScroll.stop(); setSelected(technology); }
          }}
          onPointerCancelCapture={() => { gesture.current.active = false; gesture.current.moved = true; }}
          onPointerMoveCapture={(event) => { if (gesture.current.active && Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 8) gesture.current.moved = true; }}
          onClickCapture={(event) => { if (event.detail !== 0 && gesture.current.moved) { event.preventDefault(); event.stopPropagation(); } }}
          onDragStart={(event) => event.preventDefault()} role="region" aria-label="Tecnologias Digitale" aria-roledescription="carrossel">
        <ul className="flex md:grid md:grid-cols-4 items-center md:justify-items-center md:gap-x-6 md:gap-y-6">
          {technologies.map((technology, index) => (
            <li key={technology.name} className="min-w-0 flex-[0_0_42%] md:flex-auto flex justify-center px-3 md:px-0">
              <motion.button initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.6, delay: reduceMotion ? 0 : index * 0.1, ease: "easeOut" }} type="button" aria-label={`Ver detalhes de ${technology.name}`} aria-haspopup="dialog" data-technology={technology.name} onClick={(event) => { if (event.detail === 0) { autoScroll.stop(); setSelected(technology); } }} className="digitale-technology-floating relative z-10 block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4">
                <TechnologyBadge technology={technology} />
              </motion.button>
            </li>
          ))}
        </ul>
        </div>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto overflow-x-hidden rounded-3xl sm:rounded-[2rem] p-6 pt-12 sm:p-10 gap-6">
          {selected && (
            <>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-8">
                <TechnologyBadge technology={selected} large />
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <DialogTitle className="text-2xl sm:text-3xl leading-tight text-foreground font-medium">{selected.name}</DialogTitle>
                  <div className="h-0.5 w-10 bg-accent my-4 mx-auto sm:mx-0" />
                  <DialogDescription className="sr-only">Detalhes da tecnologia {selected.name} da Digitale Têxtil.</DialogDescription>
                  {isLoading ? <p role="status" className="text-muted-foreground">Carregando informações…</p> : isError ? (
                    <div role="alert"><p>Não foi possível carregar as informações.</p><button type="button" onClick={() => refetch()} className="mt-3 text-accent underline">Tentar novamente</button></div>
                  ) : <p className="text-base sm:text-lg text-muted-foreground leading-relaxed whitespace-pre-line break-words">{details?.description || details?.short_description || "Informações indisponíveis no momento."}</p>}
                </div>
              </div>
              {benefits.length > 0 && <div><h3 className="font-semibold mb-3">Principais diferenciais</h3><ul className="space-y-2 text-muted-foreground list-disc pl-5">{benefits.map((item, index) => <li key={index} className="break-words">{item}</li>)}</ul></div>}
              {applications.length > 0 && <div><h3 className="font-semibold mb-3">Aplicações</h3><ul className="flex flex-wrap gap-2">{applications.map((item, index) => <li key={index} className="border border-border rounded-full px-3 py-1 text-sm break-words">{item}</li>)}</ul></div>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
