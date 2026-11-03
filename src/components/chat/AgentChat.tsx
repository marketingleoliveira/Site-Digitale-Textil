import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Minus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { trackEvent, getTrackingVisitorKey } from "@/lib/tracking";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  isTyping?: boolean;
}

const SESSION_KEY = "digitale_chat_session";
const CONV_KEY = "digitale_chat_conv";
const STATE_KEY = "digitale_chat_state"; // 'open' | 'minimized' | 'closed'
const AUTO_OPEN_KEY = "digitale_chat_autoopened"; // marca páginas onde já abrimos automaticamente

// Páginas onde o agente fica ativo, com saudação e contexto específicos.
const PAGE_CONFIGS: Record<
  string,
  { context: string; greeting: (name: string) => string }
> = {
  tecidos: {
    context: "tecidos",
    greeting: (n) =>
      `Oi! Aqui é o ${n}, assistente virtual comercial da Digitale. 😊 Vi que você tá olhando nossa linha de tecidos — qual segmento da sua marca/confecção (fitness, moda íntima, praia, esportivo, profissional)?`,
  },
  estampas: {
    context: "estampas",
    greeting: (n) =>
      `Oi! Aqui é o ${n}, assistente virtual comercial da Digitale. 🎨 Tô vendo que você curte nossa cartela de estampas — você procura algo pra qual coleção/segmento (fitness, praia, moda íntima)?`,
  },
};

function detectPageConfig(pathname: string) {
  if (pathname.startsWith("/tecidos")) return PAGE_CONFIGS.tecidos;
  if (pathname.startsWith("/estampas")) return PAGE_CONFIGS.estampas;
  return null;
}

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function AgentChat() {
  const location = useLocation();
  const pageConfig = detectPageConfig(location.pathname);
  const { whatsappLink } = useSiteSettings();
  const [state, setState] = useState<"closed" | "open" | "minimized">("closed");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [agentName, setAgentName] = useState("Rafael");
  const [greeting, setGreeting] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [showBubble, setShowBubble] = useState(false);
  const [unread, setUnread] = useState(0);
  const conversationIdRef = useRef<string | null>(localStorage.getItem(CONV_KEY));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load settings
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("agent_settings")
        .select("agent_name, greeting, is_enabled")
        .eq("key", "main")
        .maybeSingle();
      if (mounted && data) {
        setAgentName(data.agent_name || "Rafael");
        setGreeting(data.greeting || "");
        setIsEnabled(data.is_enabled !== false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Restore previous state
  useEffect(() => {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved === "minimized") setState("minimized");
  }, []);

  // Show bubble after delay
  useEffect(() => {
    if (!isEnabled || !pageConfig) return;
    const timer = setTimeout(() => setShowBubble(true), 1500);
    return () => clearTimeout(timer);
  }, [isEnabled, pageConfig]);

  // Auto-open chat on supported pages (once per page per session)
  useEffect(() => {
    if (!isEnabled || !pageConfig) return;
    const key = `${AUTO_OPEN_KEY}_${pageConfig.context}`;
    if (sessionStorage.getItem(key)) return;
    const t = setTimeout(() => {
      setState((s) => (s === "closed" ? "open" : s));
      sessionStorage.setItem(key, "1");
    }, 2500);
    return () => clearTimeout(t);
  }, [isEnabled, pageConfig]);

  // Auto-greet when opened first time
  useEffect(() => {
    if (state !== "open" || hasGreeted) return;
    const text = pageConfig
      ? pageConfig.greeting(agentName || "Rafael")
      : greeting;
    if (text) {
      setHasGreeted(true);
      simulateTyping(text, "greet-1");
    }
  }, [state, hasGreeted, greeting, pageConfig, agentName]);

  // Persist state
  useEffect(() => {
    localStorage.setItem(STATE_KEY, state);
    if (state === "open") setUnread(0);
  }, [state]);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  function simulateTyping(text: string, id: string, speedMs = 25, minDelay = 700) {
    // Fase 1: "pensando" — pausa curta antes de aparecer "digitando..."
    // Quanto mais longa a resposta, mais ele "pensa" (lê pergunta, pondera).
    const len = text.length;
    const thinkMs = Math.min(900, 300 + Math.random() * 250 + len * 2);

    setTimeout(() => {
      // Fase 2: indicador de "digitando..." com tempo proporcional ao tamanho do texto
      // Velocidade humana realista: ~45 palavras/min ≈ 4.5 chars/s ≈ 220ms/char digitando devagar
      // Usamos ~55ms/char + variação para parecer natural, com piso e teto
      setIsTyping(true);
      const typingMs = Math.max(
        minDelay,
        Math.min(1800, len * (speedMs + 5) + Math.random() * 250)
      );

      setTimeout(() => {
        setIsTyping(false);
        // Fase 3: revela a mensagem com streaming sutil de caracteres
        let i = 0;
        const msg: Message = { id, role: "bot", content: "" };
        setMessages((prev) => [...prev, msg]);
        // Streaming bem rápido só pra dar sensação de envio progressivo
        const step = Math.max(2, Math.ceil(len / 40));
        const charDelay = 20;
        const interval = setInterval(() => {
          i += step;
          const slice = text.slice(0, i);
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: slice } : m))
          );
          if (i >= len) {
            clearInterval(interval);
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, content: text } : m))
            );
            if (state !== "open") setUnread((u) => u + 1);
          }
        }, charDelay);
      }, typingMs);
    }, thinkMs);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isTyping) return;
    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("chat-agent", {
        body: {
          conversation_id: conversationIdRef.current,
          session_id: getSessionId(),
            visitor_key: getTrackingVisitorKey(),
          message: text,
          page_url: window.location.href,
          user_agent: navigator.userAgent,
          page_context: pageConfig?.context,
        },
      });
      if (error) throw error;
      if (data?.conversation_id) {
        conversationIdRef.current = data.conversation_id;
        localStorage.setItem(CONV_KEY, data.conversation_id);
      }
      const blocks: string[] =
        Array.isArray(data?.blocks) && data.blocks.length > 0
          ? data.blocks
          : [data?.reply || "Desculpa, não consegui te responder agora. Tenta de novo em instantes!"];
      sendBlocks(blocks, data?.typing_speed_ms, data?.min_typing_delay_ms);
    } catch (e) {
      sendBlocks([
        "Opa, tive um problema técnico aqui! Você pode chamar nosso time diretamente pelo WhatsApp.",
      ]);
    }
  }

  // Sends multiple blocks one after the other, each with its own typing animation,
  // with a realistic short pause between them (as if the person sent two messages).
  function sendBlocks(blocks: string[], speedMs?: number, minDelay?: number) {
    let acc = 0;
    blocks.forEach((b, idx) => {
      const len = b.length;
      // approximate total duration of this block (think + typing + reveal)
      const estimate =
        Math.min(900, 300 + len * 2) +
        Math.min(1800, len * ((speedMs || 12) + 5)) +
        300;
      setTimeout(() => {
        simulateTyping(b, `b_${Date.now()}_${idx}`, speedMs, minDelay);
      }, acc);
      // small extra human pause between blocks (400-900ms) on top of the block estimate
      acc += estimate + 250 + Math.random() * 200;
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Only render on supported pages (tecidos / estampas)
  if (!isEnabled || !pageConfig || !showBubble) return null;

  // Closed/minimized: show bubble
  if (state !== "open") {
    return (
      <button
        onClick={() => {
          void trackEvent("chat_open", {
            metadata: { context: pageConfig?.context || null },
          });
          setState("open");
        }}
        aria-label="Abrir assistente virtual"
        className="fixed bottom-6 right-24 z-50 group flex items-center gap-2 bg-accent hover:bg-accent/90 text-white rounded-full pl-4 pr-5 py-3 shadow-xl shadow-accent/30 transition-all hover:scale-105"
      >
        <div className="relative">
          <MessageCircle className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-2 -right-2 bg-white text-accent text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {unread}
            </span>
          )}
          <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-30" />
        </div>
        <span className="text-sm font-medium hidden sm:inline">
          Falar com assistente
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] sm:w-[380px] max-w-[380px] h-[560px] max-h-[calc(100vh-3rem)] bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center font-semibold text-base flex-shrink-0">
          {agentName.charAt(0).toUpperCase()}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{agentName}</p>
          <p className="text-xs text-primary-foreground/80 leading-tight">Online · Digitale Têxtil</p>
        </div>
        <button
          onClick={() => setState("minimized")}
          aria-label="Minimizar"
          className="p-1.5 hover:bg-primary-foreground/10 rounded-md transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => setState("closed")}
          aria-label="Fechar"
          className="p-1.5 hover:bg-primary-foreground/10 rounded-md transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-muted/30">
        {messages.length === 0 && !isTyping && (
          <p className="text-xs text-center text-muted-foreground py-6">
            Iniciando conversa...
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-background text-foreground border border-border rounded-bl-sm shadow-sm"
              }`}
            >
              {renderContent(m.content, () => {
                void trackEvent("whatsapp_click", {
                  metadata: { placement: "agent_chat" },
                });
                window.open(
                  whatsappLink(
                    "Olá! Vim pelo chat do site e gostaria de falar com um representante."
                  ),
                  "_blank"
                );
              })}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-background border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full typing-dot" />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full typing-dot" style={{ animationDelay: "0.15s" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full typing-dot" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border bg-background p-2 flex gap-2 items-center">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-muted/50 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          disabled={isTyping}
        />
        <button
          onClick={sendMessage}
          disabled={isTyping || !input.trim()}
          aria-label="Enviar"
          className="bg-primary text-primary-foreground rounded-full p-2.5 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot { animation: typingDot 1.2s infinite ease-in-out; }
      `}</style>
    </div>
  );
}

const HANDOFF_TAG = "[FALAR_REPRESENTANTE]";

function renderContent(content: string, onClick: () => void) {
  if (!content.includes(HANDOFF_TAG)) return content;
  const parts = content.split(HANDOFF_TAG);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && (
            <button
              type="button"
              onClick={onClick}
              className="mt-2 inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-semibold text-xs px-4 py-2 rounded-full shadow-md shadow-accent/30 transition-all hover:scale-[1.02]"
            >
              <WhatsAppIcon className="h-4 w-4" />
              FALAR COM REPRESENTANTE
            </button>
          )}
        </span>
      ))}
    </>
  );
}