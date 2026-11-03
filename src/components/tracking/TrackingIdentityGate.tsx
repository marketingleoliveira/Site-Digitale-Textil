import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getTrackingVisitorKey,
  identifyAndTrack,
} from "@/lib/tracking";
import logoColor from "@/assets/logo-color.png";

const IDENTITY_KEY = "digitale_tracking_identity";

const PROTECTED_PREFIXES = [
  "/tecidos",
  "/tecnologias",
  "/segmentos",
  "/estampas",
];

type IdentityForm = {
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  cnpj: string;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}
function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export function TrackingIdentityGate() {
  const location = useLocation();
  const [identified, setIdentified] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<IdentityForm>({
    name: "",
    company: "",
    email: "",
    whatsapp: "",
    cnpj: "",
  });

  const protectedArea = useMemo(
    () => isProtected(location.pathname),
    [location.pathname]
  );

  useEffect(() => {

    let cancelled =
      false;


    if (!protectedArea) {

      setIdentified(
        true
      );

      return () => {
        cancelled = true;
      };
    }


    /*
     * Servidor é a autoridade.
     *
     * Não usamos mais LocalStorage
     * para decidir se o formulário
     * deve aparecer.
     */
    setIdentified(
      true
    );


    const visitorKey =
      getTrackingVisitorKey();


    fetch(
      "/api/tracking/identity-status"
      +
      "?visitor_key="
      +
      encodeURIComponent(
        visitorKey
      ),
      {
        method:
          "GET",

        cache:
          "no-store",
      }
    )
      .then(
        async response => {

          if (!response.ok) {

            throw new Error(
              "identity_status_failed"
            );
          }

          return response.json();
        }
      )
      .then(
        result => {

          if (!cancelled) {

            setIdentified(
              Boolean(
                result?.identified
              )
            );
          }
        }
      )
      .catch(
        () => {

          if (!cancelled) {

            setIdentified(
              false
            );
          }
        }
      );


    return () => {
      cancelled = true;
    };

  }, [protectedArea]);

  if (!protectedArea || identified) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const cleanWhatsapp = digits(form.whatsapp);
    const cleanCnpj = digits(form.cnpj);
    const cleanEmail = form.email.trim().toLowerCase();

    const validationErrors = validateCommercialIdentity(form);
    if (validationErrors.length) {
      setError(validationErrors[0]);
      return;
    }

    setLoading(true);

    const identity = {
      name: form.name.trim(),
      company: form.company.trim(),
      email: cleanEmail,
      whatsapp: cleanWhatsapp,
      cnpj: cleanCnpj,
    };

    const registered =
      await identifyAndTrack(
        "identity_gate_submit",
        identity,
        {
          metadata: {
            gate:
              "commercial_area",

            requested_path:
              location.pathname,
          },
        }
      );


    /*
     * Só libera depois que o backend
     * confirmou a persistência.
     */
    if (!registered) {

      setError(
        "Não foi possível concluir o registro. Tente novamente."
      );

      setLoading(
        false
      );

      return;
    }


    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify(
        identity
      )
    );

    setIdentified(
      true
    );

    setLoading(
      false
    );
  };
  return (
    <div className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur-md overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-xl bg-white border border-border rounded-3xl shadow-2xl p-6 md:p-9">
          <div className="flex justify-center mb-5">
            <img src={logoColor} alt="Digitale Têxtil" className="h-14 object-contain" />
          </div>

          <div className="text-center mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-2">
              Acesso comercial
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Queremos te conhecer
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Para acessar tecidos, tecnologias, segmentos e estampas, preencha seus dados comerciais.
              Isso permite que nossa equipe personalize o atendimento ao seu interesse.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tracking-name">Nome *</Label>
                <Input id="tracking-name" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoComplete="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking-company">Empresa *</Label>
                <Input id="tracking-company" value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  autoComplete="organization" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking-email">E-mail *</Label>
                <Input id="tracking-email" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tracking-whatsapp">WhatsApp *</Label>
                <Input id="tracking-whatsapp" value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  inputMode="tel" autoComplete="tel" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking-cnpj">CNPJ *</Label>
              <Input id="tracking-cnpj" value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                inputMode="numeric" required />
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Registrando..." : "Continuar para o conteúdo"}
            </Button>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Os dados serão associados ao histórico de navegação para atendimento comercial.
              Consulte nossa{" "}
              <a href="/politica-de-privacidade" className="underline hover:text-foreground">
                Política de Privacidade
              </a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}


// STRICT_IDENTITY_VALIDATION_V1
function validateCommercialIdentity(value: IdentityForm) {
  const errors = [];
  const name = String(value?.name || "").trim();
  const company = String(value?.company || "").trim();
  const email = String(value?.email || "").trim();
  let phone = String(value?.whatsapp || "").replace(/\D/g, "");
  const cnpj = String(value?.cnpj || "").replace(/[.\-/\s]/g, "");

  if (name.length < 2 || name.length > 180 || !/\p{L}/u.test(name))
    errors.push("Informe seu nome.");
  if (company.length < 2 || company.length > 180 || !/\p{L}/u.test(company))
    errors.push("Informe sua empresa.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    errors.push("Informe um e-mail válido.");

  if ((phone.length === 12 || phone.length === 13) && phone.startsWith("55"))
    phone = phone.slice(2);

  const ddds = new Set(
    "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(" ")
  );
  const phoneValid = ddds.has(phone.slice(0, 2))
    && (/^\d{2}[2-5]\d{7}$/.test(phone)
      || /^\d{2}9\d{8}$/.test(phone))
    && !/^(\d)\1+$/.test(phone.slice(2));

  if (!phoneValid)
    errors.push("Informe um telefone válido com DDD.");

  let cnpjValid = /^\d{14}$/.test(cnpj) && !/^(\d)\1+$/.test(cnpj);
  if (cnpjValid) {
    for (const size of [12, 13]) {
      let sum = 0;
      let weight = size - 7;
      for (let i = 0; i < size; i++) {
        sum += Number(cnpj[i]) * weight;
        weight--;
        if (weight < 2) weight = 9;
      }
      const remainder = sum % 11;
      const check = remainder < 2 ? 0 : 11 - remainder;
      if (Number(cnpj[size]) !== check) cnpjValid = false;
    }
  }
  if (!cnpjValid)
    errors.push("Informe um CNPJ válido, incluindo os dígitos verificadores.");

  return errors;
}
