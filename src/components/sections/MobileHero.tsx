
import {
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from "react";

interface MobileHeroProps {
  imageUrl: string;
  altText: string;
  onNext: () => void;
  onPrevious: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}

export function MobileHero({
  imageUrl,
  altText,
  onNext,
  onPrevious,
  onInteractionStart,
  onInteractionEnd,
}: MobileHeroProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showPanHint, setShowPanHint] = useState(true);

  const offsetRef = useRef(0);

  useEffect(() => {
    if (!showPanHint) return;

    const timer = window.setTimeout(() => {
      setShowPanHint(false);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [showPanHint]);


  const touch = useRef({
    x: 0,
    y: 0,
    offset: 0,
  });

  const updateOffset = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const maxPan = () => {
    const viewport = viewportRef.current;
    const image = imageRef.current;

    if (!viewport || !image) return 0;

    return Math.max(
      0,
      image.offsetWidth - viewport.clientWidth
    );
  };

  const clampOffset = (value: number) =>
    Math.max(-maxPan(), Math.min(0, value));

  useEffect(() => {
    const resize = () => {
      updateOffset(clampOffset(offsetRef.current));
    };

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  const handleTouchStart = (
    e: TouchEvent<HTMLDivElement>
  ) => {
    if (e.touches.length !== 1) return;

    const point = e.touches[0];

    touch.current = {
      x: point.clientX,
      y: point.clientY,
      offset: offsetRef.current,
    };

    onInteractionStart();
    setDragging(true);
  };

  const handleTouchMove = (
    e: TouchEvent<HTMLDivElement>
  ) => {
    if (e.touches.length !== 1) return;

    const point = e.touches[0];

    const dx = point.clientX - touch.current.x;
    const dy = point.clientY - touch.current.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      updateOffset(
        clampOffset(touch.current.offset + dx)
      );
    }
  };

  const handleTouchEnd = (
    e: TouchEvent<HTMLDivElement>
  ) => {
    setDragging(false);
    onInteractionEnd();

    if (!e.changedTouches.length) return;

    const point = e.changedTouches[0];

    const dx = point.clientX - touch.current.x;
    const dy = point.clientY - touch.current.y;

    if (
      Math.abs(dy) > 55 &&
      Math.abs(dy) > Math.abs(dx) * 1.2
    ) {
      if (dy < 0) {
        onNext();
      } else {
        onPrevious();
      }
    }
  };

  return (
    <div
      ref={viewportRef}
      className="digitale-mobile-hero md:hidden relative w-full overflow-hidden bg-white"
      style={{
        height: "clamp(190px, 56vw, 290px)",
        touchAction: "none",
      }}
      onTouchStart={(event) => {
        setShowPanHint(false);
        handleTouchStart(event);
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        setDragging(false);
        onInteractionEnd();
      }}
      aria-label="Banner: arraste para os lados para explorar e para cima para avançar"
    >
      <div className="digitale-mobile-slide-enter absolute inset-0 overflow-hidden">
        <img
          ref={imageRef}
          src={imageUrl}
          alt={altText}
          draggable={false}
          onLoad={() => updateOffset(0)}
          className="block h-full select-none"
          style={{
            width: "auto",
            minWidth: "100%",
            maxWidth: "none",
            objectFit: "contain",
            transform: `translate3d(${offset}px, 0, 0)`,
            transition: dragging
              ? "none"
              : "transform 180ms ease-out",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>


      {/* DIGITALE_MOBILE_BANNER_HINT_V2 */}
      {showPanHint && (
        <div
          className="absolute bottom-3 left-0 right-0 z-30 flex justify-center px-3 pointer-events-none"
          aria-hidden="true"
        >
          <div className="digitale-pan-hint">
            <span className="digitale-pan-arrow">←</span>
            <span>Arraste para os lados</span>
            <span className="digitale-pan-arrow">→</span>
          </div>
        </div>
      )}


      <style>{`
        .digitale-pan-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 9px 16px;
          border-radius: 999px;
          background: rgba(19, 48, 86, 0.88);
          color: white;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.2;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: digitalePanHintPulse 1.8s ease-in-out infinite;
        }

        .digitale-pan-arrow {
          font-size: 18px;
          font-weight: 600;
        }

        @keyframes digitalePanHintPulse {
          0%, 100% {
            transform: translateX(0);
            opacity: 0.95;
          }
          25% {
            transform: translateX(-3px);
          }
          75% {
            transform: translateX(3px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .digitale-pan-hint {
            animation: none;
          }
        }


        @keyframes digitaleMobileSlideUp {
          from {
            transform: translateY(100%);
            opacity: 0.65;
          }

          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .digitale-mobile-slide-enter {
          animation:
            digitaleMobileSlideUp 550ms
            cubic-bezier(.22, 1, .36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .digitale-mobile-slide-enter {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
