import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronRight, Newspaper, Filter, Eye, Sparkles, X, Heart, Share2, Lightbulb, Send, Link2, MessageCircle, Smile, Frown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/radar/PdfViewer";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import radarHeader from "@/assets/radar-header.png";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface RadarCategory {
  id: string;
  name: string;
  slug: string;
  is_active: boolean | number;
}

interface RadarEdition {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  edition_date: string;
  cover_image_url: string | null;
  file_url: string;
  description: string | null;
  views: number;
  likes: number;
  happy_count?: number | null;
  sad_count?: number | null;
  radar_categories: RadarCategory | null;
}

const getViewCount = (edition: RadarEdition): number => {
  return edition.views ?? 0;
};

const formatViews = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toString();
};



const RADAR_VISITOR_KEY =
  "digitale_radar_visitor_v1";

const getRadarVisitorId = (): string => {
  try {
    const saved =
      localStorage.getItem(
        RADAR_VISITOR_KEY
      );

    if (saved) return saved;

    const value =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `radar-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    localStorage.setItem(
      RADAR_VISITOR_KEY,
      value
    );

    return value;
  } catch {
    return `radar-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
  }
};

const RadarDigitale = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const LIKES_STORAGE_KEY = "radar_liked_editions_v1";
  const [likedEditions, setLikedEditions] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LIKES_STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  // Persist liked editions to localStorage so the device "remembers" forever
  useEffect(() => {
    try {
      localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(Array.from(likedEditions)));
    } catch {}
  }, [likedEditions]);

  // Reações (feliz / triste) por edição, memorizadas neste dispositivo
  const REACTIONS_STORAGE_KEY = "radar_reactions_v1";
  const [reactions, setReactions] = useState<Record<string, "happy" | "sad">>(() => {
    try {
      const raw = localStorage.getItem(REACTIONS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(reactions));
    } catch {}
  }, [reactions]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestForm, setSuggestForm] = useState({ topic: "", name: "", email: "", message: "" });
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);

  const submitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = suggestForm.topic.trim();
    if (topic.length < 3) {
      toast.error("Descreva o tema com pelo menos 3 caracteres.");
      return;
    }
    if (topic.length > 200) {
      toast.error("O tema deve ter no máximo 200 caracteres.");
      return;
    }
    const email = suggestForm.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("E-mail inválido.");
      return;
    }
    setSubmittingSuggestion(true);
    const { error } = await supabase.from("radar_topic_suggestions").insert({
      topic,
      name: suggestForm.name.trim().slice(0, 120) || null,
      email: email.slice(0, 200) || null,
      message: suggestForm.message.trim().slice(0, 1000) || null,
      page_url: window.location.href,
    });
    setSubmittingSuggestion(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      return;
    }
    toast.success("Sugestão enviada! Obrigado por contribuir.");
    setSuggestForm({ topic: "", name: "", email: "", message: "" });
    setSuggestOpen(false);
  };

  const shareEdition = async (
    via: "native" | "copy" | "whatsapp" | "facebook" | "twitter" | "linkedin" | "email"
  ) => {
    if (!activeEdition) return;
    const url = `${window.location.origin}/radar-digitale?ed=${activeEdition.slug || activeEdition.id}`;
    const title = activeEdition.title;
    const text = `Confira "${title}" no Radar Digitale da Digitale Têxtil.`;
    if (via === "native" && (navigator as any).share) {
      try { await (navigator as any).share({ title, text, url }); } catch {}
      return;
    }
    if (via === "copy") {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
      } catch {
        toast.error("Não foi possível copiar o link");
      }
      return;
    }
    const enc = encodeURIComponent;
    const map: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${enc(text + " " + url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
      email: `mailto:?subject=${enc(title)}&body=${enc(text + "\n\n" + url)}`,
    };
    window.open(map[via], "_blank", "noopener,noreferrer");
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["radar-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radar_categories")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as RadarCategory[];
    },
  });

  const { data: editions = [], isLoading } = useQuery({
    queryKey: ["radar-editions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radar_editions")
        .select("*, radar_categories(*)")
        .order("edition_date", { ascending: false });
      if (error) throw error;
      return data as RadarEdition[];
    },
  });

  // Show every active category, even without editions.
  const categoriesWithEditions = categories.filter(
    (cat) => Boolean(cat.is_active)
  );

  // The "first" edition in the admin order — gets the NOVO badge
  const firstEditionId = editions[0]?.id;

  const filteredEditions = useMemo(() => {
    let result = editions;
    if (selectedCategory) {
      result = result.filter((e) => e.category_id === selectedCategory);
    }
    if (dateFrom) {
      result = result.filter((e) => new Date(e.edition_date) >= dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter((e) => new Date(e.edition_date) <= endOfDay);
    }
    return result;
  }, [editions, selectedCategory, dateFrom, dateTo]);

  const activeEdition = selectedEdition
    ? editions.find((e) => e.id === selectedEdition)
    : filteredEditions[0];

  const likeMutation = useMutation({
    mutationFn: async (editionId: string) => {
      const res = await fetch(
        "/api/functions/radar-like",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            edition_id: editionId,
            visitor_id: getRadarVisitorId(),
          }),
        }
      );

      const data =
        await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Erro ao processar curtida"
        );
      }

      return data;
    },
    onSuccess: (data, editionId) => {
      setLikedEditions((prev) => {
        const next = new Set(prev);
        if (data.liked) {
          next.add(editionId);
        } else {
          next.delete(editionId);
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["radar-editions"] });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({
      editionId,
      reaction,
    }: {
      editionId: string;
      reaction: "happy" | "sad";
    }) => {
      const res = await fetch(
        "/api/functions/radar-reaction",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            edition_id: editionId,
            reaction,
            visitor_id: getRadarVisitorId(),
          }),
        }
      );

      const data =
        await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Erro ao registrar reação"
        );
      }

      return data as {
        reaction:
          | "happy"
          | "sad"
          | null;
        happy_count: number;
        sad_count: number;
      };
    },
    onSuccess: (data, variables) => {
      setReactions((prev) => {
        const next = { ...prev };
        if (data.reaction) next[variables.editionId] = data.reaction;
        else delete next[variables.editionId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["radar-editions"] });
    },
    onError: () => toast.error("Não foi possível registrar sua reação."),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SEO title="Radar Digitale – Tendências de Moda e Tecidos" description="Radar Digitale: tendências de moda, comportamento e inovações em tecidos para inspirar suas próximas coleções." keywords="tendências de moda, tendências têxteis, radar de moda, inovação têxtil, fashion trends Brasil" />
      <main>
        {/* Hero */}
        <section className="bg-white py-8 md:py-12">
          <div className="container mx-auto px-4 md:px-6 flex flex-col items-center gap-4">
            <img
              src={radarHeader}
              alt="Radar Digitale - Boletim Informativo"
              className="max-w-full h-auto max-h-[200px] md:max-h-[280px] object-contain"
            />
            {editions.length > 0 && (
              <div className="group relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-accent/10 via-primary/5 to-accent/10 border border-accent/20 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-300 animate-fade-in cursor-default overflow-hidden">
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                </span>
                <p className="relative text-muted-foreground text-sm md:text-base font-medium">
                  Tivemos + de{" "}
                  <span className="text-accent font-bold text-lg md:text-2xl tracking-tight bg-gradient-to-r from-accent via-orange-500 to-accent bg-[length:200%_auto] bg-clip-text text-transparent animate-[shimmer_3s_linear_infinite]">
                    {formatViews(editions.reduce((sum, e) => sum + getViewCount(e), 0))}
                  </span>{" "}
                  leitores
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Content */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4 md:px-6">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Main Content - Edition Viewer */}
              <div className="flex-1 min-w-0 order-1 lg:order-2">
                {isLoading ? (
                  <div className="bg-card rounded-2xl border border-border p-8">
                    <Skeleton className="h-8 w-2/3 mb-4" />
                    <Skeleton className="h-4 w-1/3 mb-8" />
                    <Skeleton className="h-[600px] w-full rounded-xl" />
                  </div>
                ) : !activeEdition ? (
                  <div className="bg-card rounded-2xl border border-border p-12 text-center">
                    <Newspaper className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-foreground mb-2">
                      Nenhuma edição disponível
                    </h2>
                    <p className="text-muted-foreground">
                      Em breve teremos novidades por aqui!
                    </p>
                  </div>
                ) : (
                  <motion.div
                    key={activeEdition.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl border border-border overflow-hidden"
                  >
                    {/* Edition Header */}
                    <div className="p-6 md:p-8 border-b border-border">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        {activeEdition.radar_categories && (
                          <Badge className="bg-accent text-accent-foreground">
                            {activeEdition.radar_categories.name}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Edição {new Date(activeEdition.edition_date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <Eye className="h-4 w-4" />
                          <span>{formatViews(getViewCount(activeEdition))} leituras</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => likeMutation.mutate(activeEdition.id)}
                          disabled={likeMutation.isPending}
                          className={cn(
                            "gap-2 transition-all",
                            likedEditions.has(activeEdition.id)
                              ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                              : "hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                          )}
                        >
                          <Heart className={cn("h-4 w-4", likedEditions.has(activeEdition.id) && "fill-red-500")} />
                          Curtir · {formatViews(activeEdition.likes ?? 0)}
                        </Button>
                        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              reactionMutation.mutate({ editionId: activeEdition.id, reaction: "happy" })
                            }
                            disabled={reactionMutation.isPending}
                            aria-label="Gostei desta edição"
                            className={cn(
                              "gap-1.5 h-8 px-2 transition-all",
                              reactions[activeEdition.id] === "happy"
                                ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
                                : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"
                            )}
                          >
                            <Smile className="h-4 w-4" />
                            {formatViews(activeEdition.happy_count ?? 0)}
                          </Button>
                          <span className="h-4 w-px bg-border" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              reactionMutation.mutate({ editionId: activeEdition.id, reaction: "sad" })
                            }
                            disabled={reactionMutation.isPending}
                            aria-label="Não gostei desta edição"
                            className={cn(
                              "gap-1.5 h-8 px-2 transition-all",
                              reactions[activeEdition.id] === "sad"
                                ? "bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
                                : "text-muted-foreground hover:bg-amber-50 hover:text-amber-600"
                            )}
                          >
                            <Frown className="h-4 w-4" />
                            {formatViews(activeEdition.sad_count ?? 0)}
                          </Button>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 hover:border-accent hover:bg-accent/10 hover:text-accent transition-all"
                            >
                              <Share2 className="h-4 w-4" />
                              Compartilhar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {typeof navigator !== "undefined" && (navigator as any).share && (
                              <DropdownMenuItem onClick={() => shareEdition("native")}>
                                <Share2 className="h-4 w-4 mr-2" /> Compartilhar...
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => shareEdition("copy")}>
                              <Link2 className="h-4 w-4 mr-2" /> Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareEdition("whatsapp")}>
                              <MessageCircle className="h-4 w-4 mr-2 text-green-600" /> WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareEdition("linkedin")}>
                              <Share2 className="h-4 w-4 mr-2 text-blue-700" /> LinkedIn
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareEdition("facebook")}>
                              <Share2 className="h-4 w-4 mr-2 text-blue-600" /> Facebook
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareEdition("twitter")}>
                              <Share2 className="h-4 w-4 mr-2" /> X / Twitter
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => shareEdition("email")}>
                              <Send className="h-4 w-4 mr-2" /> E-mail
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                        {activeEdition.title}
                      </h2>
                      {activeEdition.description && (
                        <p className="text-muted-foreground mt-2">{activeEdition.description}</p>
                      )}
                    </div>

                    {/* Edition Content - embedded file */}
                    <div>
                      {activeEdition.file_url.endsWith(".pdf") ? (
                        <PdfViewer url={activeEdition.file_url} title={activeEdition.title} />
                      ) : (
                        <img
                          src={activeEdition.file_url}
                          alt={activeEdition.title}
                          className="w-full object-cover"
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Sidebar */}
              <aside className="lg:w-72 flex-shrink-0 order-2 lg:order-1">
                <div className="lg:sticky lg:top-24 space-y-6">
                  {/* Suggest Topic CTA */}
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => setSuggestOpen(true)}
                          size="lg"
                          className="w-full justify-start gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-bold uppercase tracking-wider shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                        >
                          <Lightbulb className="h-5 w-5" />
                          Sugerir Tema
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" align="start" className="max-w-xs">
                        <p className="text-sm leading-relaxed">
                          Tem um assunto que gostaria de ler aqui no Radar Digitale?
                          Envie sua sugestão de tema e nossa redação pode transformá-la
                          em uma próxima edição.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Category Filter */}
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Filter className="h-4 w-4 text-accent" />
                      <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Categorias</h3>
                    </div>
                    <div className="space-y-1">
                      <button
                        onClick={() => { setSelectedCategory(null); setSelectedEdition(null); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          !selectedCategory
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        Todas as edições
                      </button>
                      {categoriesWithEditions.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => { setSelectedCategory(cat.id); setSelectedEdition(null); }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            selectedCategory === cat.id
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Filter */}
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-4 w-4 text-accent" />
                      <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">Filtrar por data</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">De</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left text-sm font-normal h-9", !dateFrom && "text-muted-foreground")}>
                              <Calendar className="mr-2 h-3.5 w-3.5" />
                              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Selecionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Até</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left text-sm font-normal h-9", !dateTo && "text-muted-foreground")}>
                              <Calendar className="mr-2 h-3.5 w-3.5" />
                              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Selecionar"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {(dateFrom || dateTo) && (
                        <button
                          onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <X className="h-3 w-3" /> Limpar filtro
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Editions List */}
                  <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
                        Edições
                      </h3>
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {filteredEditions.length}
                      </span>
                    </div>
                    <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 -mr-1">
                      {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full rounded-xl" />
                        ))
                      ) : filteredEditions.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          Nenhuma edição encontrada.
                        </p>
                      ) : (
                        filteredEditions.map((edition) => {
                          const isActive = activeEdition?.id === edition.id;
                          const isNew = edition.id === firstEditionId;
                          return (
                            <button
                              key={edition.id}
                              onClick={() => setSelectedEdition(edition.id)}
                              className={`relative w-full text-left p-3 rounded-xl transition-all duration-200 group overflow-hidden ${
                                isActive
                                  ? "bg-accent/5 ring-1 ring-accent/30 shadow-sm"
                                  : "hover:bg-muted/60 ring-1 ring-transparent hover:ring-border"
                              }`}
                            >
                              <span
                                className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all ${
                                  isActive ? "bg-accent" : "bg-transparent group-hover:bg-border"
                                }`}
                              />
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <p className={`text-sm font-semibold leading-snug line-clamp-2 ${
                                  isActive ? "text-accent" : "text-foreground group-hover:text-accent"
                                }`}>
                                  {edition.title}
                                </p>
                                {isNew && (
                                  <Badge className="bg-green-500 hover:bg-green-500 text-white text-[9px] font-bold tracking-wider px-1.5 py-0 h-4 shrink-0 shadow-sm">
                                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                    NOVO
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                <span className="font-medium whitespace-nowrap">
                                  {new Date(edition.edition_date).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="flex items-center gap-1 whitespace-nowrap" title="Visualizações">
                                    <Eye className="h-3 w-3" />
                                    {formatViews(getViewCount(edition))} visualizações
                                  </span>
                                  <span className="flex items-center gap-1 whitespace-nowrap">
                                    <Heart className={`h-3 w-3 ${likedEditions.has(edition.id) ? "fill-red-500 text-red-500" : ""}`} />
                                    {formatViews(edition.likes ?? 0)}
                                  </span>
                                  {(() => {
                                    const happy = edition.happy_count ?? 0;
                                    const sad = edition.sad_count ?? 0;
                                    const total = happy + sad;
                                    if (total === 0) return null;
                                    const pct = Math.round((happy / total) * 100);
                                    return (
                                      <span
                                        className={`flex items-center gap-1 font-semibold whitespace-nowrap ${
                                          pct >= 50 ? "text-green-600" : "text-red-500"
                                        }`}
                                        title={`Aprovação: ${pct}% (${happy} positivas / ${sad} negativas)`}
                                      >
                                        {pct >= 50 ? <Smile className="h-3 w-3" /> : <Frown className="h-3 w-3" />}
                                        {pct}% aprovação
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                              {edition.radar_categories && (
                                <Badge variant="outline" className="mt-2 text-[9px] font-medium px-1.5 py-0 h-4 border-accent/30 text-accent/80 bg-accent/5">
                                  {edition.radar_categories.name}
                                </Badge>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Lightbulb className="h-5 w-5 text-accent" />
              </div>
              <div>
                <DialogTitle>Sugerir um tema</DialogTitle>
                <DialogDescription>
                  Conte qual assunto você gostaria de ler em uma próxima edição do Radar Digitale.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={submitSuggestion} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="topic">Tema sugerido *</Label>
              <Input
                id="topic"
                required
                maxLength={200}
                placeholder="Ex.: Tendências de moda praia 2027"
                value={suggestForm.topic}
                onChange={(e) => setSuggestForm({ ...suggestForm, topic: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome (opcional)</Label>
                <Input
                  id="name"
                  maxLength={120}
                  value={suggestForm.name}
                  onChange={(e) => setSuggestForm({ ...suggestForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  maxLength={200}
                  placeholder="voce@empresa.com"
                  value={suggestForm.email}
                  onChange={(e) => setSuggestForm({ ...suggestForm, email: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Detalhes (opcional)</Label>
              <Textarea
                id="message"
                maxLength={1000}
                rows={4}
                placeholder="Conte por que esse tema interessa, perguntas que gostaria de ver respondidas, etc."
                value={suggestForm.message}
                onChange={(e) => setSuggestForm({ ...suggestForm, message: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSuggestOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submittingSuggestion} className="gap-2">
                <Send className="h-4 w-4" />
                {submittingSuggestion ? "Enviando..." : "Enviar sugestão"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default RadarDigitale;
