import { useState } from "react";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { identifyAndTrack } from "@/lib/tracking";

export function NewsletterForm() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

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
        .insert([{ email, source: "footer" }]);

      if (error) {
        if (error.code === "23505") {
          // Duplicate email
          toast.info(t("newsletter.alreadySubscribed"));
        } else {
          throw error;
        }
      } else {
        void identifyAndTrack("newsletter_submit", { email }, {
          metadata: { source_form: "newsletter_footer" },
        });
        setSubscribed(true);
        toast.success(t("newsletter.success"));
      }
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      toast.error(t("newsletter.error"));
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="flex items-center gap-3 text-green-400">
        <CheckCircle className="h-5 w-5" />
        <span className="text-sm">{t("newsletter.thanks")}</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-white/70 mb-3">
        {t("newsletter.description")}
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("newsletter.placeholder")}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-accent"
            disabled={loading}
          />
        </div>
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("newsletter.button")
          )}
        </Button>
      </div>
    </form>
  );
}
