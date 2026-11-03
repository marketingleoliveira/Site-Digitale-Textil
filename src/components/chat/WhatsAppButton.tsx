import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { trackEvent } from "@/lib/tracking";

export function WhatsAppButton() {
  const { t } = useLanguage();
  const { whatsappLink } = useSiteSettings();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Hide the floating WhatsApp button inside the admin panel
  const isAdmin = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (isAdmin) {
      setIsVisible(false);
      return;
    }
    // Show button after scrolling a bit or after 3 seconds
    const timer = setTimeout(() => setIsVisible(true), 3000);

    const handleScroll = () => {
      if (window.scrollY > 200) {
        setIsVisible(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleClick = () => {
    void trackEvent("whatsapp_click", {
      metadata: { placement: "floating_button" },
    });
    window.open(whatsappLink(t("whatsapp.defaultMessage")), "_blank");
  };

  if (isAdmin) return null;

  return (
    <>
      {isVisible && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
        >
          {/* Tooltip */}

            {showTooltip && (
              <div
                className="bg-white rounded-lg shadow-xl p-4 max-w-[280px] relative"
              >
                <button
                  onClick={() => setShowTooltip(false)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-sm text-foreground font-medium mb-1">
                  {t("whatsapp.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("whatsapp.subtitle")}
                </p>
                <Button
                  onClick={handleClick}
                  size="sm"
                  className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white"
                >
                  {t("whatsapp.startChat")}
                </Button>
              </div>
            )}


          {/* WhatsApp Button */}
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="group relative bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg shadow-green-500/30 transition-colors"
          >
            <WhatsAppIcon className="h-6 w-6" />

            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-25" />
          </button>
        </div>
      )}
    </>
  );
}
