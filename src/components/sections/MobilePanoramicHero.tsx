import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";

type Slide = {
  id: string;
  image_url: string;
  alt_text?: string | null;
};

type Props = {
  slides: Slide[];
};

// Galeria panorâmica circular exclusiva para mobile.
// As três cópias da sequência permitem atravessar
// o limite sem interromper o movimento.
export function MobilePanoramicHero({ slides }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [slideWidth, setSlideWidth] = useState(950);
  const [fadeSlide, setFadeSlide] = useState<Slide | null>(null);
  const [fadeVisible, setFadeVisible] = useState(false);
  const [active, setActive] = useState(0);
  const initialized = useRef(false);
  // DIGITALE_BANNER_MOUSE_DRAG_V1
  const mouseDragRef = useRef<{
    pointerId: number;
    lastX: number;
  } | null>(null);


  const count = slides.length;
  const groupWidth = count * slideWidth;

  // Cada banner mantém a proporção panorâmica 1900:500.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const measure = () => {
      const height = viewport.getBoundingClientRect().height;

      if (height > 0) {
        setSlideWidth(Math.round(height * 1900 / 500));
      }
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  // Posiciona a navegação na cópia central,
  // deixando imagens disponíveis nos dois sentidos.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || !count) return;

    initialized.current = false;
    viewport.scrollLeft = groupWidth;
    setActive(0);
    initialized.current = true;
  }, [count, groupWidth]);

  const handleScroll = () => {
    const viewport = viewportRef.current;

    if (!viewport || !count || !initialized.current) return;

    let position = viewport.scrollLeft;

    // Normalização circular, sem alterar a imagem visível.
    if (position < groupWidth) {
      position += groupWidth;
      viewport.scrollLeft = position;
    } else if (position >= groupWidth * 2) {
      position -= groupWidth;
      viewport.scrollLeft = position;
    }

    const relative = (
      (position - groupWidth) % groupWidth + groupWidth
    ) % groupWidth;

    const index = Math.floor(
      (relative + 0.001) / slideWidth
    ) % count;

    setActive(index);
  };

  const goTo = (index: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({
      left: groupWidth + index * slideWidth,
      behavior: "smooth"
    });
  };


  // DIGITALE_MOBILE_AUTO_FADE_V1
  // Após 5 segundos sem interação, troca de imagem
  // com o mesmo fade de 500ms utilizado no desktop.
  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport || count < 2 || slideWidth <= 0) return;

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let loadingImage: HTMLImageElement | null = null;

    const stopTimers = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (revealTimer) clearTimeout(revealTimer);
      idleTimer = undefined;
      fadeTimer = undefined;
      revealTimer = undefined;
    };

    const cancelAutomatic = () => {
      stopTimers();

      if (loadingImage) {
        loadingImage.onload = null;
        loadingImage.onerror = null;
        loadingImage = null;
      }

      setFadeVisible(false);
      setFadeSlide(null);
    };

    const schedule = () => {
      if (disposed) return;
      stopTimers();

      idleTimer = setTimeout(() => {
        if (disposed || !initialized.current) return;

        // Identifica em qual banner o usuário parou,
        // inclusive se percorreu a imagem parcialmente.
        const relative = (
          ((viewport.scrollLeft - groupWidth) % groupWidth)
          + groupWidth
        ) % groupWidth;

        const currentIndex = Math.floor(
          relative / slideWidth
        ) % count;

        const nextIndex = (currentIndex + 1) % count;
        const nextSlide = slides[nextIndex];

        if (!nextSlide) return;

        // Carrega a próxima imagem antes do fade
        // para evitar um flash em branco.
        const image = new Image();
        loadingImage = image;

        const showNext = () => {
          if (disposed || loadingImage !== image) return;

          loadingImage = null;
          setFadeSlide(nextSlide);
          setFadeVisible(false);

          revealTimer = setTimeout(() => {
            if (disposed) return;
            setFadeVisible(true);
          }, 40);

          fadeTimer = setTimeout(() => {
            if (disposed) return;

            // Quando a próxima imagem já está visível,
            // reposiciona a faixa panorâmica sob o fade.
            viewport.scrollTo({
              left: groupWidth + nextIndex * slideWidth,
              behavior: "instant" as ScrollBehavior
            });

            setFadeSlide(null);
            setFadeVisible(false);
            schedule();
          }, 600);
        };

        image.onload = showNext;
        image.onerror = () => {
          if (loadingImage === image) {
            loadingImage = null;
            schedule();
          }
        };
        image.src = nextSlide.image_url;

        if (image.complete && image.naturalWidth > 0) {
          showNext();
        }
      }, 5000);
    };

    // Durante o arrasto, interrompe o automático.
    const onInteractionStart = () => {
      cancelAutomatic();
    };

    // Após a interação, reinicia a espera de 5 segundos.
    const onInteractionEnd = () => {
      schedule();
    };

    viewport.addEventListener("touchstart", onInteractionStart, {
      passive: true
    });
    viewport.addEventListener("touchend", onInteractionEnd, {
      passive: true
    });
    viewport.addEventListener("touchcancel", onInteractionEnd, {
      passive: true
    });
    viewport.addEventListener("mousedown", onInteractionStart);
    window.addEventListener("mouseup", onInteractionEnd);

    schedule();

    return () => {
      disposed = true;
      cancelAutomatic();

      viewport.removeEventListener("touchstart", onInteractionStart);
      viewport.removeEventListener("touchend", onInteractionEnd);
      viewport.removeEventListener("touchcancel", onInteractionEnd);
      viewport.removeEventListener("mousedown", onInteractionStart);
      window.removeEventListener("mouseup", onInteractionEnd);
    };
  }, [count, groupWidth, slideWidth, slides]);

  if (!count) return null;

  const repeatedSlides = [
    ...slides,
    ...slides,
    ...slides
  ];

  return (
    <section
      aria-label="Banners Digitale Têxtil"
      className="block md:hidden relative w-full bg-[#1F3147]"
    >
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        onPointerDown={(event) => {
          // O toque mantém a rolagem nativa do mobile.
          if (event.pointerType !== "mouse" || event.button !== 0) return;

          mouseDragRef.current = {
            pointerId: event.pointerId,
            lastX: event.clientX
          };

          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.style.cursor = "grabbing";
        }}
        onPointerMove={(event) => {
          const drag = mouseDragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;

          event.preventDefault();
          const delta = event.clientX - drag.lastX;
          drag.lastX = event.clientX;

          // Movimento incremental preserva a normalização circular.
          event.currentTarget.scrollLeft -= delta;
        }}
        onPointerUp={(event) => {
          if (mouseDragRef.current?.pointerId !== event.pointerId) return;

          mouseDragRef.current = null;
          event.currentTarget.style.cursor = "grab";

          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (mouseDragRef.current?.pointerId !== event.pointerId) return;
          mouseDragRef.current = null;
          event.currentTarget.style.cursor = "grab";
        }}
        onLostPointerCapture={(event) => {
          mouseDragRef.current = null;
          event.currentTarget.style.cursor = "grab";
        }}

        className="w-full overflow-x-auto overflow-y-hidden"
        style={{
          height: "clamp(220px, 58vw, 340px)",
          touchAction: "pan-x pan-y",
          cursor: "grab",
          userSelect: "none",
          overscrollBehaviorX: "contain",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch"
        }}
      >
        <div
          className="flex h-full"
          style={{
            width: `${repeatedSlides.length * slideWidth}px`
          }}
        >
          {repeatedSlides.map((slide, index) => (
            <div
              key={`${index}-${slide.id}`}
              className="relative h-full shrink-0 overflow-hidden"
              style={{ width: `${slideWidth}px` }}
            >
              <img
                src={slide.image_url}
                alt={slide.alt_text || "Banner Digitale"}
                loading={
                  index >= count && index < count * 2
                    ? "eager"
                    : "lazy"
                }
                draggable={false}
                className="h-full w-full max-w-none object-cover select-none"
              />
            </div>
          ))}
        </div>
      </div>


      {/* Fade automático, igual ao desktop.
          Não bloqueia o gesto horizontal do usuário. */}
      {fadeSlide && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 overflow-hidden transition-opacity duration-500 ease-in-out ${
            fadeVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <img
            src={fadeSlide.image_url}
            alt=""
            draggable={false}
            className="h-full max-w-none object-cover"
            style={{ width: `${slideWidth}px` }}
          />
        </div>
      )}

      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 pointer-events-none">
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black/45 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
            <span aria-hidden="true">↔</span>
            Arraste para o lado
          </span>
        </div>
      )}

    </section>
  );
}
