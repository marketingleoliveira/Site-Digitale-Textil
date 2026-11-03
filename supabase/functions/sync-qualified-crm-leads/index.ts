import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SALES_PORTAL_WEBHOOK =
  "https://ddgbqeaqksiamnnzioyv.supabase.co/functions/v1/ingest-qualified-crm-lead";

type Delivery = {
  id: string;
  fabric_lead_id: string;
  attempt_count: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("CRM_LEAD_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: "Integração não configurada" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let requestedLeadId: string | undefined;
  try {
    const body = await req.json();
    requestedLeadId = typeof body?.lead_id === "string" ? body.lead_id : undefined;
  } catch {
    requestedLeadId = undefined;
  }

  let deliveryQuery = admin
    .from("crm_lead_deliveries")
    .select("id,fabric_lead_id,attempt_count")
    .in("status", ["pending", "failed"])
    .lt("attempt_count", 10)
    .order("created_at", { ascending: true })
    .limit(25);

  if (requestedLeadId) deliveryQuery = deliveryQuery.eq("fabric_lead_id", requestedLeadId);

  const { data: deliveries, error: deliveryError } = await deliveryQuery;
  if (deliveryError) {
    console.error("Unable to load CRM delivery queue", deliveryError.message);
    return new Response(JSON.stringify({ error: "Não foi possível ler a fila" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let delivered = 0;
  let failed = 0;

  for (const delivery of (deliveries ?? []) as Delivery[]) {
    const [{ data: lead, error: leadError }, { data: validation, error: validationError }] =
      await Promise.all([
        admin.from("fabric_leads").select("id,fabric_name,cnpj,whatsapp,email,cnae,created_at").eq("id", delivery.fabric_lead_id).single(),
        admin.from("lead_validations").select("status,score,recommendation,ai_summary,validated_at").eq("fabric_lead_id", delivery.fabric_lead_id).single(),
      ]);

    if (leadError || validationError || !lead || !validation || validation.status !== "qualified") {
      await admin.from("crm_lead_deliveries").update({
        status: "failed",
        attempt_count: delivery.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: "Lead ou validação qualificada indisponível",
      }).eq("id", delivery.id);
      failed += 1;
      continue;
    }

    const companyDomain = lead.email?.split("@")[1]?.split(".")[0] ?? "";
    const companyName = companyDomain
      ? companyDomain.charAt(0).toUpperCase() + companyDomain.slice(1)
      : "Lead do Agente CRM";

    try {
      const response = await fetch(SALES_PORTAL_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-crm-webhook-secret": webhookSecret,
        },
        body: JSON.stringify({
          source_system: "digitale_institucional",
          external_lead_id: lead.id,
          qualification_status: "qualified",
          qualification_score: validation.score,
          company_name: companyName,
          fabric_name: lead.fabric_name,
          cnpj: lead.cnpj,
          whatsapp: lead.whatsapp,
          email: lead.email,
          cnae: lead.cnae ?? undefined,
          recommendation: validation.recommendation ?? undefined,
          ai_summary: validation.ai_summary ?? undefined,
          validated_at: validation.validated_at
            ? new Date(validation.validated_at).toISOString()
            : undefined,
        }),
      });

      const responseText = await response.text();
      if (!response.ok) throw new Error(`Portal respondeu ${response.status}: ${responseText.slice(0, 300)}`);

      await admin.from("crm_lead_deliveries").update({
        status: "delivered",
        attempt_count: delivery.attempt_count + 1,
        delivered_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", delivery.id);
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      console.error("CRM lead delivery failed", delivery.fabric_lead_id, message);
      await admin.from("crm_lead_deliveries").update({
        status: "failed",
        attempt_count: delivery.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: message.slice(0, 1000),
      }).eq("id", delivery.id);
      failed += 1;
    }
  }

  return new Response(JSON.stringify({ processed: deliveries?.length ?? 0, delivered, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});