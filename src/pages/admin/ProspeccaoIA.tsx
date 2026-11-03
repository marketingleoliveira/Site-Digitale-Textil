import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Bot,
  CheckCircle2,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Target,
} from "lucide-react";

import { toast } from "sonner";


type Summary = {
  total: number | null;
  discovered: number | null;
  validating: number | null;
  qualified: number | null;
  rejected: number | null;
  intent_verified: number | null;
  textile_relevance_verified: number | null;
  queue?: {
    queued: number | null;
    pending: number | null;
    synced: number | null;
  };
  crm_delivery_enabled: boolean;
};

type Campaign = {
  id: string;
  name: string;
  niche: string;
  region?: string | null;
  products?: string | null;
  target_profile?: string | null;
  exclusions?: string | null;
  minimum_intent: string;
  max_candidates: number;
  status: string;
  created_at: string;
};

type Candidate = {
  id: string;
  campaign_id: string;
  company_name: string;
  cnpj?: string | null;
  website?: string | null;
  domain?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  status: string;

  company_verified: number;
  icp_verified: number;
  contact_verified: number;
  recent_activity_verified: number;
  intent_verified: number;
  textile_relevance_verified: number;
  second_validation_passed: number;

  confidence_score: number;
  created_at: string;
};


function authHeader() {
  try {
    const raw =
      localStorage.getItem(
        "digitale-auth"
      );

    const session =
      raw
        ? JSON.parse(raw)
        : null;

    return session?.access_token
      ? {
          Authorization:
            `Bearer ${session.access_token}`,
        }
      : {};
  } catch {
    return {};
  }
}


async function apiGet(path: string) {
  const response =
    await fetch(
      path,
      {
        headers: authHeader(),
      }
    );

  const body =
    await response.json();

  if (
    !response.ok
    || body?.error
  ) {
    throw new Error(
      body?.error?.message
      || body?.error
      || "Erro na API de prospecção"
    );
  }

  return body.data;
}


async function apiPost(
  path: string,
  payload: any
) {
  const response =
    await fetch(
      path,
      {
        method: "POST",
        headers: {
          ...authHeader(),
          "Content-Type":
            "application/json",
        },
        body:
          JSON.stringify(payload),
      }
    );

  const body =
    await response.json();

  if (
    !response.ok
    || body?.error
  ) {
    throw new Error(
      body?.error?.message
      || body?.error
      || "Erro na API de prospecção"
    );
  }

  return body.data;
}


function number(value: any) {
  const parsed =
    Number(value || 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function StatusBadge({
  status,
}: {
  status: string;
}) {
  if (status === "qualified") {
    return (
      <Badge className="bg-emerald-600">
        Qualificado
      </Badge>
    );
  }

  if (status === "rejected") {
    return (
      <Badge variant="destructive">
        Rejeitado
      </Badge>
    );
  }

  if (status === "validating") {
    return (
      <Badge
        variant="outline"
        className="border-amber-400 text-amber-700"
      >
        Em validação
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      Descoberto
    </Badge>
  );
}


function Gate({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs "
        + (
          ok
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-border bg-muted/30 text-muted-foreground"
        )
      }
    >
      {
        ok
          ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          )
          : (
            <ShieldX className="h-3.5 w-3.5 shrink-0" />
          )
      }

      <span>{label}</span>
    </div>
  );
}


export default function ProspeccaoIA() {
  const queryClient =
    useQueryClient();

  const [name, setName] =
    useState("");

  const [niche, setNiche] =
    useState("Moda fitness");

  const [region, setRegion] =
    useState("Brasil");

  const [products, setProducts] =
    useState(
      "Leggings, tops, shorts, bermudas"
    );

  const [
    targetProfile,
    setTargetProfile,
  ] = useState(
    "Marca própria ou confecção"
  );

  const [
    exclusions,
    setExclusions,
  ] = useState(
    "Academias, suplementos, lojas multimarcas e revendedores"
  );


  const summary =
    useQuery<Summary>({
      queryKey: [
        "prospecting-summary",
      ],
      queryFn: () =>
        apiGet(
          "/api/prospecting/summary"
        ),
      refetchInterval: 30000,
    });


  const campaigns =
    useQuery<Campaign[]>({
      queryKey: [
        "prospecting-campaigns",
      ],
      queryFn: () =>
        apiGet(
          "/api/prospecting/campaigns"
        ),
    });


  const candidates =
    useQuery<Candidate[]>({
      queryKey: [
        "prospecting-candidates",
      ],
      queryFn: () =>
        apiGet(
          "/api/prospecting/candidates?limit=200"
        ),
      refetchInterval: 30000,
    });


  const createCampaign =
    useMutation({
      mutationFn: () =>
        apiPost(
          "/api/prospecting/campaigns",
          {
            name,
            niche,
            region,
            products,
            target_profile:
              targetProfile,
            exclusions,
            minimum_intent:
              "strong",
            max_candidates: 50,
          }
        ),

      onSuccess: () => {
        toast.success(
          "Campanha criada."
        );

        setName("");

        queryClient.invalidateQueries({
          queryKey: [
            "prospecting-campaigns",
          ],
        });

        queryClient.invalidateQueries({
          queryKey: [
            "prospecting-summary",
          ],
        });
      },

      onError: (error: any) => {
        toast.error(
          error?.message
          || "Não foi possível criar a campanha."
        );
      },
    });


  const stats =
    summary.data;


  const reloadAll = () => {
    queryClient.invalidateQueries({
      queryKey: [
        "prospecting-summary",
      ],
    });

    queryClient.invalidateQueries({
      queryKey: [
        "prospecting-campaigns",
      ],
    });

    queryClient.invalidateQueries({
      queryKey: [
        "prospecting-candidates",
      ],
    });
  };


  return (
    <AdminLayout title="Prospecção IA">

      <Card className="mb-6 border-2 border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Bot className="h-7 w-7" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">
                    Prospecção IA
                  </h2>

                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-700"
                  >
                    Quarentena ativa
                  </Badge>

                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-700"
                  >
                    CRM bloqueado
                  </Badge>
                </div>

                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  Empresas descobertas pela IA passam por sete validações obrigatórias.
                  Score alto sozinho não libera nenhum lead para o CRM.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={reloadAll}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>


      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Candidatos
            </p>
            <p className="text-2xl font-bold">
              {number(stats?.total)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-amber-700">
              Em validação
            </p>
            <p className="text-2xl font-bold text-amber-700">
              {number(stats?.validating)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700">
              Qualificados
            </p>
            <p className="text-2xl font-bold text-emerald-700">
              {number(stats?.qualified)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Fila CRM
            </p>
            <p className="text-2xl font-bold">
              {number(
                stats?.queue?.queued
              )}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Entrega desativada
            </p>
          </CardContent>
        </Card>

      </div>


      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" />
            Nova campanha de prospecção
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">

            <div>
              <p className="mb-1 text-xs font-medium">
                Nome da campanha
              </p>
              <Input
                value={name}
                onChange={event =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="Ex.: Marcas fitness Brasil"
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium">
                Nicho
              </p>
              <Input
                value={niche}
                onChange={event =>
                  setNiche(
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium">
                Região
              </p>
              <Input
                value={region}
                onChange={event =>
                  setRegion(
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium">
                Produtos procurados
              </p>
              <Input
                value={products}
                onChange={event =>
                  setProducts(
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium">
                Perfil desejado
              </p>
              <Input
                value={targetProfile}
                onChange={event =>
                  setTargetProfile(
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-medium">
                Excluir
              </p>
              <Input
                value={exclusions}
                onChange={event =>
                  setExclusions(
                    event.target.value
                  )
                }
              />
            </div>

          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">

            <p className="text-xs text-muted-foreground">
              Intenção mínima:
              {" "}
              <strong>
                forte
              </strong>
              {" · "}
              máximo:
              {" "}
              <strong>
                50 candidatos
              </strong>
            </p>

            <Button
              onClick={() =>
                createCampaign.mutate()
              }
              disabled={
                createCampaign.isPending
                || !name.trim()
                || !niche.trim()
              }
              className="gap-2"
            >
              <Plus className="h-4 w-4" />

              {
                createCampaign.isPending
                  ? "Criando..."
                  : "Criar campanha"
              }
            </Button>

          </div>
        </CardContent>
      </Card>


      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Campanhas
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">

              {
                campaigns.isLoading
                  ? (
                    <p className="text-sm text-muted-foreground">
                      Carregando...
                    </p>
                  )
                  : !(campaigns.data || []).length
                    ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma campanha criada.
                      </p>
                    )
                    : (
                      (campaigns.data || []).map(
                        campaign => (
                          <div
                            key={campaign.id}
                            className="rounded-xl border p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">
                                  {campaign.name}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {campaign.niche}
                                  {
                                    campaign.region
                                      ? ` · ${campaign.region}`
                                      : ""
                                  }
                                </p>
                              </div>

                              <Badge variant="outline">
                                {campaign.status}
                              </Badge>
                            </div>

                            {
                              campaign.products
                                ? (
                                  <p className="mt-3 text-xs text-muted-foreground">
                                    {campaign.products}
                                  </p>
                                )
                                : null
                            }

                            <p className="mt-2 text-[11px] text-muted-foreground">
                              Intenção mínima:
                              {" "}
                              {campaign.minimum_intent}
                            </p>
                          </div>
                        )
                      )
                    )
              }

            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">
                Candidatos em quarentena
              </CardTitle>

              <Badge
                variant="outline"
                className="gap-1"
              >
                <ShieldCheck className="h-3 w-3" />
                7 hard gates
              </Badge>
            </div>
          </CardHeader>

          <CardContent>

            {
              candidates.isLoading
                ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando candidatos...
                  </p>
                )
                : !(candidates.data || []).length
                  ? (
                    <div className="rounded-xl border border-dashed p-10 text-center">
                      <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                      <p className="font-medium">
                        Nenhum candidato externo
                      </p>

                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        A infraestrutura de validação está ativa.
                        A descoberta automática será conectada na próxima etapa.
                      </p>
                    </div>
                  )
                  : (
                    <div className="space-y-4">

                      {(candidates.data || []).map(
                        candidate => (
                          <div
                            key={candidate.id}
                            className="rounded-xl border p-4"
                          >

                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold">
                                    {candidate.company_name}
                                  </p>

                                  <StatusBadge
                                    status={candidate.status}
                                  />
                                </div>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {
                                    candidate.domain
                                    || candidate.website
                                    || "Domínio não informado"
                                  }

                                  {
                                    candidate.segment
                                      ? ` · ${candidate.segment}`
                                      : ""
                                  }
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-2xl font-bold">
                                  {number(
                                    candidate.confidence_score
                                  )}
                                </p>

                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  score informativo
                                </p>
                              </div>

                            </div>


                            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">

                              <Gate
                                ok={
                                  candidate.company_verified === 1
                                }
                                label="Empresa verificada"
                              />

                              <Gate
                                ok={
                                  candidate.icp_verified === 1
                                }
                                label="ICP confirmado"
                              />

                              <Gate
                                ok={
                                  candidate.contact_verified === 1
                                }
                                label="Contato verificável"
                              />

                              <Gate
                                ok={
                                  candidate.recent_activity_verified === 1
                                }
                                label="Atividade recente"
                              />

                              <Gate
                                ok={
                                  candidate.intent_verified === 1
                                }
                                label="Intenção confirmada"
                              />

                              <Gate
                                ok={
                                  candidate.textile_relevance_verified === 1
                                }
                                label="Relevância têxtil"
                              />

                              <Gate
                                ok={
                                  candidate.second_validation_passed === 1
                                }
                                label="2ª validação"
                              />

                              <Gate
                                ok={
                                  candidate.status === "qualified"
                                }
                                label="Elegível para CRM"
                              />

                            </div>

                          </div>
                        )
                      )}

                    </div>
                  )
            }

          </CardContent>
        </Card>

      </div>


      <Card className="mt-6 border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-700" />

            <div>
              <p className="text-sm font-medium text-amber-900">
                Entrega automática ao Agendor ainda desativada
              </p>

              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Esta fase serve para provar a qualidade da descoberta e das evidências.
                Nenhum candidato externo é enviado ao CRM por esta tela.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </AdminLayout>
  );
}
