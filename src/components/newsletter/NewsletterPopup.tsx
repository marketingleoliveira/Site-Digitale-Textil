import { useState, useEffect } from "react";
import { X, Mail, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import logoColor from "@/assets/logo-color-header.webp";
import { identifyAndTrack } from "@/lib/tracking";

const POPUP_STORAGE_KEY = "newsletter_popup_shown";
const POPUP_DELAY = 5000; // 5 seconds

export function NewsletterPopup() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Check if popup was already shown
    const hasShown = localStorage.getItem(POPUP_STORAGE_KEY);

    if (!hasShown) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        localStorage.setItem(POPUP_STORAGE_KEY, "true");
      }, POPUP_DELAY);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error(t("newsletter.invalidEmail"));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert([{ email, source: "popup" }]);

      if (error) {
        if (error.code === "23505") {
          toast.info(t("newsletter.alreadySubscribed"));
          setIsOpen(false);
        } else {
          throw error;
        }
      } else {
        void identifyAndTrack("newsletter_submit", { email }, {
          metadata: { source_form: "newsletter_popup" },
        });
        setSubscribed(true);
        toast.success(t("newsletter.success"));
        setTimeout(() => setIsOpen(false), 2000);
      }
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      toast.error(t("newsletter.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-primary to-primary/90 border-none text-primary-foreground">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center p-3 shadow-lg">
              <img src={logoColor} alt="Digitale" className="w-full h-full object-contain" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-display text-center text-primary-foreground">
            {t("newsletter.popupTitle")}
          </DialogTitle>
          <DialogDescription className="text-center text-primary-foreground/80">
            {t("newsletter.popupDescription")}
          </DialogDescription>
        </DialogHeader>

          {subscribed ? (
            <div
              key="success"
              className="flex flex-col items-center gap-3 py-6"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <p className="text-lg font-medium text-primary-foreground">
                {t("newsletter.thanks")}
              </p>
            </div>
          ) : (
            <form
              key="form"
              onSubmit={handleSubmit}
              className="space-y-4 mt-4"
            >
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("newsletter.placeholder")}
                  className="pl-11 h-12 bg-white text-foreground placeholder:text-muted-foreground border-none focus-visible:ring-accent"
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  t("newsletter.popupButton")
                )}
              </Button>
              <p className="text-xs text-center text-primary-foreground/60">
                {t("newsletter.privacy")}
              </p>
            </form>
          )}

      </DialogContent>
    </Dialog>
  );
}
