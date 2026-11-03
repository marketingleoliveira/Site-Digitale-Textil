import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { identifyAndTrack } from "@/lib/tracking";

interface FabricLeadFormProps {
  fabricId: string;
  fabricName: string;
  fabricSlug: string;
}

export function FabricLeadForm({ fabricId, fabricName, fabricSlug }: FabricLeadFormProps) {
  const [cnpj, setCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  };

  const formatWhatsapp = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCnpj = cnpj.replace(/\D/g, "");
    const cleanWhatsapp = whatsapp.replace(/\D/g, "");

    if (cleanCnpj.length !== 14) {
      toast.error("CNPJ inválido. Insira os 14 dígitos.");
      return;
    }
    if (cleanWhatsapp.length < 10) {
      toast.error("WhatsApp inválido.");
      return;
    }
    if (!email.includes("@")) {
      toast.error("E-mail inválido.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("fabric_leads").insert({
      fabric_id: fabricId,
      fabric_name: fabricName,
      fabric_slug: fabricSlug,
      cnpj: cleanCnpj,
      whatsapp: cleanWhatsapp,
      email,
    });
    setLoading(false);

    if (error) {
      toast.error("Erro ao enviar. Tente novamente.");
      return;
    }

    void identifyAndTrack("fabric_lead_submit", {
      email,
      whatsapp: cleanWhatsapp,
      cnpj: cleanCnpj,
    }, {
      entityType: "fabric",
      entitySlug: fabricSlug,
      metadata: {
        fabric_id: fabricId,
        fabric_name: fabricName,
      },
    });

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 text-center space-y-3">
        <CheckCircle className="h-10 w-10 text-accent mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Solicitação enviada com sucesso!</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Agradecemos seu interesse no tecido <strong>{fabricName}</strong>. Em breve, um de nossos representantes entrará em contato com todas as informações técnicas solicitadas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-secondary/50 border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
          <Lock className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Especificações Técnicas</h3>
          <p className="text-xs text-muted-foreground">
            Preencha seus dados para receber as especificações completas deste tecido.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="CNPJ"
          value={cnpj}
          onChange={(e) => setCnpj(formatCnpj(e.target.value))}
          required
        />
        <Input
          placeholder="WhatsApp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
          required
        />
        <Input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Solicitar Informações Técnicas
        </Button>
      </form>
    </div>
  );
}
