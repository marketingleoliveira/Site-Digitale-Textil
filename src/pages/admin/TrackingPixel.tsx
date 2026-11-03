import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  Flame,
  MousePointerClick,
  Search,
  UserCheck,
  Users,
  Eye,
  RefreshCw,
  FileDown,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Visitor = {
  visitor_key: string;
  first_seen: string;
  last_seen: string;
  first_path?: string | null;
  last_path?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  device_type?: string | null;
  browser?: string | null;
  score: number;
  total_events: number;
  page_views: number;
  sessions: number;
  lead_name?: string | null;
  lead_email?: string | null;
  lead_phone?: string | null;
  lead_company?: string | null;
  lead_cnpj?: string | null;
  identified_at?: string | null;
};

type TrackingEvent = {
  id: string;
  event_type: string;
  path?: string | null;
  page_title?: string | null;
  entity_slug?: string | null;
  score_delta: number;
  metadata?: any;
  created_at: string;
};

function authHeader() {
  try {
    const raw = localStorage.getItem("digitale-auth");
    const session = raw ? JSON.parse(raw) : null;
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch {
    return {};
  }
}
async function apiGet(path: string) {
  const response = await fetch(path, { headers: authHeader() });
  const body = await response.json();
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || body?.error || "Erro ao carregar tracking");
  }
  return body.data;
}

async function apiDelete(path: string) {

  const response =
    await fetch(
      path,
      {
        method: "DELETE",
        headers: authHeader(),
      }
    );

  const body =
    await response.json();

  if (
    !response.ok
    ||
    body?.error
  ) {

    throw new Error(
      body?.error?.message
      ||
      body?.error
      ||
      "Erro ao excluir lead"
    );
  }

  return body.data;
}

function heat(score: number) {
  if (score >= 40) return { label: "Quente", className: "bg-red-100 text-red-700" };
  if (score >= 20) return { label: "Aquecendo", className: "bg-orange-100 text-orange-700" };
  if (score >= 10) return { label: "Interessado", className: "bg-amber-100 text-amber-700" };
  return { label: "Visitante", className: "bg-slate-100 text-slate-700" };
}

const EVENT_LABELS: Record<string, string> = {
  session_start: "Nova sessão",
  page_view: "Página visitada",
  engaged_60s: "Permaneceu 60s",
  whatsapp_click: "Clique no WhatsApp",
  fabric_lead_submit: "Solicitou informações do tecido",
  contact_submit: "Enviou formulário de contato",
  newsletter_submit: "Inscreveu-se na newsletter",
  identity_gate_submit: "Identificação obrigatória",
  chat_open: "Abriu o chat",
  chat_message: "Enviou mensagem no chat",
  technology_interest: "Interesse em tecnologia",
  segment_interest: "Interesse em segmento",
  cta_click: "Clique em CTA",

  wholesale_landing_view:
    "Visitou página de atacado",

  wholesale_catalog_click:
    "Abriu catálogo de tecidos",

  wholesale_whatsapp_click:
    "WhatsApp - Atacado",

  wholesale_sample_click:
    "Solicitou amostra - Atacado",

  wholesale_quote_click:
    "Solicitou orçamento - Atacado",

};
export default function TrackingPixelAdmin() {
  const [search, setSearch] = useState("");
  const [heatFilter, setHeatFilter] = useState("all");
  const [identifiedFilter, setIdentifiedFilter] = useState("all");
  const [selected, setSelected] = useState<Visitor | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const [exportCandidates, setExportCandidates] =
    useState<Visitor[]>([]);

  const [exportFrom, setExportFrom] =
    useState("");

  const [exportTo, setExportTo] =
    useState("");

  const [selectedExportKeys, setSelectedExportKeys] =
    useState<Set<string>>(new Set());

  const summaryQuery = useQuery({
    queryKey: ["tracking-summary"],
    queryFn: () => apiGet("/api/tracking/admin/summary"),
    refetchInterval: 30000,
  });

  const visitorsQuery = useQuery({
    queryKey: ["tracking-visitors", search, heatFilter, identifiedFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "300" });
      if (search.trim()) params.set("search", search.trim());
      if (heatFilter !== "all") params.set("heat", heatFilter);
      if (identifiedFilter !== "all") params.set("identified", identifiedFilter);
      return apiGet(`/api/tracking/admin/visitors?${params.toString()}`);
    },
    refetchInterval: 30000,
  });

  const eventsQuery = useQuery({
    queryKey: ["tracking-events", selected?.visitor_key],
    queryFn: () => apiGet(
      `/api/tracking/admin/visitors/${encodeURIComponent(selected!.visitor_key)}/events`
    ),
    enabled: Boolean(selected),
  });
  const summary = summaryQuery.data || {};
  const visitors: Visitor[] = visitorsQuery.data || [];
  const events: TrackingEvent[] = eventsQuery.data || [];

  const identifiedCount = useMemo(
    () => visitors.filter((v) => v.identified_at).length,
    [visitors]
  );

  const refresh = () => {
    summaryQuery.refetch();
    visitorsQuery.refetch();
    if (selected) eventsQuery.refetch();
  };

  /*
   * ========================================================
   * EXPORTACAO SELETIVA DE LEADS
   * ========================================================
   */

  const invalidExportRange =
    Boolean(
      exportFrom
      &&
      exportTo
      &&
      exportFrom > exportTo
    );


  const filteredExportLeads =
    useMemo(
      () => {

        if (invalidExportRange) {
          return [];
        }

        return exportCandidates.filter(
          visitor => {

            if (!visitor.identified_at) {
              return false;
            }

            const identifiedDate =
              new Date(
                visitor.identified_at
              );

            if (
              Number.isNaN(
                identifiedDate.getTime()
              )
            ) {
              return false;
            }

            const dateKey =
              format(
                identifiedDate,
                "yyyy-MM-dd"
              );

            if (
              exportFrom
              &&
              dateKey < exportFrom
            ) {
              return false;
            }

            if (
              exportTo
              &&
              dateKey > exportTo
            ) {
              return false;
            }

            return true;
          }
        );
      },
      [
        exportCandidates,
        exportFrom,
        exportTo,
        invalidExportRange,
      ]
    );


  const selectedExportLeads =
    useMemo(
      () =>
        filteredExportLeads.filter(
          visitor =>
            selectedExportKeys.has(
              visitor.visitor_key
            )
        ),
      [
        filteredExportLeads,
        selectedExportKeys,
      ]
    );


  const allFilteredSelected =
    filteredExportLeads.length > 0
    &&
    filteredExportLeads.every(
      visitor =>
        selectedExportKeys.has(
          visitor.visitor_key
        )
    );


  const openExportDialog =
    async () => {

      setExportOpen(
        true
      );

      setExportLoading(
        true
      );

      setExportFrom(
        ""
      );

      setExportTo(
        ""
      );

      setSelectedExportKeys(
        new Set()
      );

      try {

        /*
         * Consulta exclusiva de leads identificados.
         * Visitantes anônimos nunca entram na seleção.
         */
        const data =
          await apiGet(
            "/api/tracking/admin/visitors?identified=yes&limit=5000"
          );


        const leads: Visitor[] =
          (
            Array.isArray(data)
              ? data
              : []
          ).filter(
            (visitor: Visitor) =>
              Boolean(
                visitor.identified_at
              )
          );


        /*
         * Segurança contra relatório parcial.
         */
        const expectedCount =
          Number(
            summary?.identified
            || 0
          );


        if (
          expectedCount > 0
          &&
          leads.length < expectedCount
        ) {

          throw new Error(
            `Foram carregados ${leads.length} de ${expectedCount} leads identificados. `
            +
            "A seleção foi interrompida para evitar uma exportação incompleta."
          );
        }


        setExportCandidates(
          leads
        );

      } catch (error: any) {

        console.error(
          "Erro ao carregar leads para exportação:",
          error
        );

        window.alert(
          error?.message
          ||
          "Não foi possível carregar os leads identificados."
        );

        setExportOpen(
          false
        );

      } finally {

        setExportLoading(
          false
        );
      }
    };


  const changeExportFrom =
    (
      value: string
    ) => {

      setExportFrom(
        value
      );

      /*
       * Ao alterar o período,
       * limpa a seleção anterior para
       * evitar exportação acidental.
       */
      setSelectedExportKeys(
        new Set()
      );
    };


  const changeExportTo =
    (
      value: string
    ) => {

      setExportTo(
        value
      );

      setSelectedExportKeys(
        new Set()
      );
    };


  const toggleExportLead =
    (
      visitorKey: string,
      checked: boolean
    ) => {

      setSelectedExportKeys(
        previous => {

          const next =
            new Set(
              previous
            );

          if (checked) {

            next.add(
              visitorKey
            );

          } else {

            next.delete(
              visitorKey
            );
          }

          return next;
        }
      );
    };


  const toggleAllFiltered =
    () => {

      setSelectedExportKeys(
        previous => {

          const next =
            new Set(
              previous
            );

          if (allFilteredSelected) {

            filteredExportLeads.forEach(
              visitor =>
                next.delete(
                  visitor.visitor_key
                )
            );

          } else {

            filteredExportLeads.forEach(
              visitor =>
                next.add(
                  visitor.visitor_key
                )
            );
          }

          return next;
        }
      );
    };


  const clearExportSelection =
    () => {

      setSelectedExportKeys(
        new Set()
      );
    };


  const exportSelectedLeadsPdf =
    async () => {

      if (invalidExportRange) {

        window.alert(
          "A data inicial não pode ser posterior à data final."
        );

        return;
      }


      const leads =
        selectedExportLeads;


      if (!leads.length) {

        window.alert(
          "Selecione pelo menos um lead para exportar."
        );

        return;
      }


      setExportingPdf(
        true
      );


      try {

        const [
          { jsPDF },
          autoTableModule
        ] =
          await Promise.all([
            import("jspdf"),
            import("jspdf-autotable"),
          ]);


        const autoTable =
          (autoTableModule as any).default
          ||
          (autoTableModule as any).autoTable;


        if (
          typeof autoTable !== "function"
        ) {

          throw new Error(
            "Gerador de tabela PDF indisponível."
          );
        }


        const pdf =
          new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
          });


        const generatedAt =
          format(
            new Date(),
            "dd/MM/yyyy HH:mm",
            {
              locale: ptBR
            }
          );


        const safeDate =
          (
            value?: string | null
          ) => {

            if (!value) {
              return "—";
            }


            const date =
              new Date(
                value
              );


            if (
              Number.isNaN(
                date.getTime()
              )
            ) {
              return "—";
            }


            return format(
              date,
              "dd/MM/yyyy HH:mm",
              {
                locale: ptBR
              }
            );
          };


        const trafficSource =
          (
            visitor: Visitor
          ) => {

            const parts = [
              visitor.source,
              visitor.medium,
              visitor.campaign,
            ].filter(
              Boolean
            );


            return parts.length
              ? parts.join(" / ")
              : "Direto";
          };


        const humanDate =
          (
            value: string
          ) => {

            if (!value) {
              return "";
            }

            const [
              year,
              month,
              day
            ] =
              value.split("-");

            return `${day}/${month}/${year}`;
          };


        let periodLabel =
          "Todos os períodos";


        if (
          exportFrom
          &&
          exportTo
        ) {

          periodLabel =
            `${humanDate(exportFrom)} até ${humanDate(exportTo)}`;

        } else if (exportFrom) {

          periodLabel =
            `A partir de ${humanDate(exportFrom)}`;

        } else if (exportTo) {

          periodLabel =
            `Até ${humanDate(exportTo)}`;
        }


        pdf.setFontSize(
          16
        );

        pdf.text(
          "Digitale Têxtil - Leads identificados",
          14,
          14
        );


        pdf.setFontSize(
          9
        );

        pdf.text(
          `Origem: SITE | Leads selecionados: ${leads.length} | Gerado em: ${generatedAt}`,
          14,
          20
        );

        pdf.text(
          `Período de identificação: ${periodLabel}`,
          14,
          25
        );


        autoTable(
          pdf,
          {
            startY: 30,

            head: [[
              "Nome",
              "Empresa",
              "E-mail",
              "WhatsApp",
              "CNPJ",
              "Score",
              "Tráfego",
              "Identificado em",
              "Última visita",
              "Última página",
            ]],

            body:
              leads.map(
                visitor => [
                  visitor.lead_name || "—",
                  visitor.lead_company || "—",
                  visitor.lead_email || "—",
                  visitor.lead_phone || "—",
                  visitor.lead_cnpj || "—",
                  String(
                    visitor.score || 0
                  ),
                  trafficSource(
                    visitor
                  ),
                  safeDate(
                    visitor.identified_at
                  ),
                  safeDate(
                    visitor.last_seen
                  ),
                  visitor.last_path || "—",
                ]
              ),

            styles: {
              fontSize: 7,
              cellPadding: 1.7,
              overflow: "linebreak",
              valign: "middle",
            },

            headStyles: {
              fontSize: 7,
              fontStyle: "bold",
            },

            columnStyles: {
              0: { cellWidth: 23 },
              1: { cellWidth: 25 },
              2: { cellWidth: 35 },
              3: { cellWidth: 23 },
              4: { cellWidth: 25 },
              5: { cellWidth: 11 },
              6: { cellWidth: 28 },
              7: { cellWidth: 26 },
              8: { cellWidth: 26 },
              9: { cellWidth: 47 },
            },

            margin: {
              left: 8,
              right: 8,
            },
          }
        );


        const stamp =
          format(
            new Date(),
            "yyyy-MM-dd-HHmm"
          );


        pdf.save(
          `digitale-leads-selecionados-${stamp}.pdf`
        );


        setExportOpen(
          false
        );

      } catch (error: any) {

        console.error(
          "Erro ao exportar leads selecionados:",
          error
        );

        window.alert(
          error?.message
          ||
          "Não foi possível gerar o PDF."
        );

      } finally {

        setExportingPdf(
          false
        );
      }
    };


  const deleteVisitor = async (
    visitor: Visitor
  ) => {

    const display =
      visitor.lead_name
      ||
      visitor.lead_email
      ||
      visitor.lead_phone
      ||
      "Visitante anônimo";


    const confirmed =
      window.confirm(
        `Excluir "${display}" do Tracking Pixel?\n\n`
        +
        "O histórico de navegação e a persistência por IP deste lead também serão removidos. "
        +
        "Esta ação não pode ser desfeita."
      );


    if (!confirmed) {
      return;
    }


    setDeletingKey(
      visitor.visitor_key
    );


    try {

      await apiDelete(
        `/api/tracking/admin/visitors/${
          encodeURIComponent(
            visitor.visitor_key
          )
        }`
      );


      if (
        selected?.visitor_key
        ===
        visitor.visitor_key
      ) {

        setSelected(
          null
        );
      }


      await Promise.all([
        visitorsQuery.refetch(),
        summaryQuery.refetch(),
      ]);


    } catch (error: any) {

      window.alert(
        error?.message
        ||
        "Não foi possível excluir o lead."
      );


    } finally {

      setDeletingKey(
        null
      );
    }
  };

  return (
    <AdminLayout title="Tracking Pixel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Intenção de compra, origem, comportamento e identificação dos visitantes do site.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            onClick={() =>
              void openExportDialog()
            }
            disabled={exportLoading || exportingPdf}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {exportLoading
              ? "Carregando leads..."
              : "Exportar leads identificados"}
          </Button>

          <Button
            variant="outline"
            onClick={refresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Kpi title="Visitantes" value={summary.total_visitors ?? 0} icon={Users} />
        <Kpi title="Ativos 7d" value={summary.active_7d ?? 0} icon={Activity} />
        <Kpi title="Identificados" value={summary.identified ?? identifiedCount} icon={UserCheck} />
        <Kpi title="Leads quentes" value={summary.hot ?? 0} icon={Flame} />
        <Kpi title="Eventos hoje" value={summary.events_today ?? 0} icon={Eye} />
        <Kpi title="WhatsApp 7d" value={summary.whatsapp_7d ?? 0} icon={MousePointerClick} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tecidos com mais interesse — 30 dias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary.top_fabrics || []).length ? (
              summary.top_fabrics.map((item: any, index: number) => (
                <div key={item.slug || index} className="flex items-center justify-between border-b last:border-0 py-2">
                  <span className="font-medium capitalize">{item.slug || "—"}</span>
                  <Badge variant="secondary">{item.views} visualizações</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Ainda não há dados suficientes.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Páginas mais acessadas — 30 dias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary.top_pages || []).length ? (
              summary.top_pages.map((item: any) => (
                <div key={item.path} className="flex items-center justify-between gap-4 border-b last:border-0 py-2">
                  <span className="text-sm truncate">{item.path}</span>
                  <Badge variant="secondary">{item.views}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Ainda não há dados suficientes.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <CardTitle className="text-base">Visitantes e leads por intenção</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, e-mail, telefone, empresa..."
                  className="pl-9"
                />
              </div>
              <Select value={heatFilter} onValueChange={setHeatFilter}>
                <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas temperaturas</SelectItem>
                  <SelectItem value="hot">Quentes</SelectItem>
                  <SelectItem value="warm">Aquecendo</SelectItem>
                  <SelectItem value="interested">Interessados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={identifiedFilter} onValueChange={setIdentifiedFilter}>
                <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Identificados</SelectItem>
                  <SelectItem value="no">Anônimos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead / visitante</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Visitas</TableHead>
                <TableHead>Última página</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitors.map((visitor) => {
                const h = heat(Number(visitor.score || 0));
                const display = visitor.lead_name || visitor.lead_email || visitor.lead_phone || "Visitante anônimo";
                return (
                  <TableRow key={visitor.visitor_key}>
                    <TableCell>
                      <div className="font-medium">{display}</div>
                      <div className="text-xs text-muted-foreground">
                        {visitor.lead_company || visitor.lead_email || visitor.visitor_key.slice(0, 18)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${h.className}`}>
                        {h.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold">{visitor.score}</TableCell>
                    <TableCell>
                      <div className="text-sm">{visitor.source || "Direto"}</div>
                      <div className="text-xs text-muted-foreground">{visitor.campaign || visitor.medium || ""}</div>
                    </TableCell>
                    <TableCell>{visitor.sessions} sessões · {visitor.page_views} páginas</TableCell>
                    <TableCell className="max-w-[220px] truncate">{visitor.last_path || "—"}</TableCell>
                    <TableCell>{format(new Date(visitor.last_seen), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelected(
                              visitor
                            )
                          }
                        >
                          Ver
                        </Button>

                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Excluir lead"
                          aria-label="Excluir lead"
                          disabled={
                            deletingKey
                            ===
                            visitor.visitor_key
                          }
                          onClick={() =>
                            void deleteVisitor(
                              visitor
                            )
                          }
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2
                            className="h-4 w-4"
                          />
                        </Button>

                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!visitorsQuery.isLoading && visitors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Nenhum visitante encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* EXPORT_SELECTION_DIALOG_START */}
      <Dialog
        open={exportOpen}
        onOpenChange={(open) => {
          if (!exportingPdf) {
            setExportOpen(open);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">

          <DialogHeader>
            <DialogTitle>
              Exportar leads identificados
            </DialogTitle>
          </DialogHeader>


          <div className="space-y-5">

            <div className="rounded-xl border bg-muted/20 p-4">

              <div className="grid md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Data inicial da identificação
                  </label>

                  <Input
                    type="date"
                    value={exportFrom}
                    onChange={(event) =>
                      changeExportFrom(
                        event.target.value
                      )
                    }
                  />
                </div>


                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Data final da identificação
                  </label>

                  <Input
                    type="date"
                    value={exportTo}
                    onChange={(event) =>
                      changeExportTo(
                        event.target.value
                      )
                    }
                  />
                </div>

              </div>


              {invalidExportRange && (
                <p className="mt-3 text-sm font-medium text-destructive">
                  A data inicial não pode ser posterior à data final.
                </p>
              )}


              <p className="mt-3 text-xs text-muted-foreground">
                O período considera a data em que o visitante foi identificado como lead.
              </p>

            </div>


            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

              <div>
                <p className="font-medium">
                  {filteredExportLeads.length} lead(s) no período
                </p>

                <p className="text-sm text-muted-foreground">
                  {selectedExportLeads.length} selecionado(s) para exportação
                </p>
              </div>


              <div className="flex flex-wrap gap-2">

                <Button
                  type="button"
                  variant="outline"
                  onClick={clearExportSelection}
                  disabled={
                    selectedExportLeads.length === 0
                  }
                >
                  Limpar seleção
                </Button>


                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleAllFiltered}
                  disabled={
                    filteredExportLeads.length === 0
                    ||
                    invalidExportRange
                  }
                >
                  {allFilteredSelected
                    ? "Desmarcar todos do período"
                    : "Selecionar todos do período"}
                </Button>

              </div>

            </div>


            <div className="border rounded-xl overflow-hidden">

              <div className="max-h-[420px] overflow-auto">

                <Table>

                  <TableHeader className="sticky top-0 bg-background z-10">

                    <TableRow>

                      <TableHead className="w-12">

                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={() =>
                            toggleAllFiltered()
                          }
                          aria-label="Selecionar todos os leads do período"
                          disabled={
                            filteredExportLeads.length === 0
                          }
                        />

                      </TableHead>

                      <TableHead>Lead</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Identificado em</TableHead>
                      <TableHead>Score</TableHead>

                    </TableRow>

                  </TableHeader>


                  <TableBody>

                    {filteredExportLeads.map(
                      visitor => (

                        <TableRow
                          key={
                            visitor.visitor_key
                          }
                        >

                          <TableCell>

                            <Checkbox
                              checked={
                                selectedExportKeys.has(
                                  visitor.visitor_key
                                )
                              }
                              onCheckedChange={(checked) =>
                                toggleExportLead(
                                  visitor.visitor_key,
                                  checked === true
                                )
                              }
                              aria-label={`Selecionar ${visitor.lead_name || visitor.lead_email || "lead"}`}
                            />

                          </TableCell>


                          <TableCell>

                            <div className="font-medium">
                              {visitor.lead_name || "—"}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {visitor.lead_email || "—"}
                            </div>

                          </TableCell>


                          <TableCell>
                            {visitor.lead_company || "—"}
                          </TableCell>


                          <TableCell>

                            <div className="text-sm">
                              {visitor.lead_phone || "—"}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              {visitor.lead_cnpj || ""}
                            </div>

                          </TableCell>


                          <TableCell className="whitespace-nowrap">

                            {visitor.identified_at
                              ? format(
                                  new Date(
                                    visitor.identified_at
                                  ),
                                  "dd/MM/yyyy HH:mm",
                                  {
                                    locale: ptBR
                                  }
                                )
                              : "—"}

                          </TableCell>


                          <TableCell className="font-bold">
                            {visitor.score || 0}
                          </TableCell>

                        </TableRow>
                      )
                    )}


                    {!exportLoading
                      &&
                      filteredExportLeads.length === 0
                      && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-10 text-muted-foreground"
                          >
                            Nenhum lead identificado encontrado neste período.
                          </TableCell>
                        </TableRow>
                      )}


                    {exportLoading && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-10 text-muted-foreground"
                        >
                          Carregando leads identificados...
                        </TableCell>
                      </TableRow>
                    )}

                  </TableBody>

                </Table>

              </div>

            </div>


            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">

              <Button
                type="button"
                variant="outline"
                disabled={exportingPdf}
                onClick={() =>
                  setExportOpen(
                    false
                  )
                }
              >
                Cancelar
              </Button>


              <Button
                type="button"
                disabled={
                  exportingPdf
                  ||
                  selectedExportLeads.length === 0
                  ||
                  invalidExportRange
                }
                onClick={() =>
                  void exportSelectedLeadsPdf()
                }
              >
                <FileDown className="h-4 w-4 mr-2" />

                {exportingPdf
                  ? "Gerando PDF..."
                  : `Exportar selecionados (${selectedExportLeads.length})`}
              </Button>

            </div>

          </div>

        </DialogContent>
      </Dialog>
      {/* EXPORT_SELECTION_DIALOG_END */}


      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do visitante</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <Info label="Nome" value={selected.lead_name} />
                <Info label="Empresa" value={selected.lead_company} />
                <Info label="E-mail" value={selected.lead_email} />
                <Info label="Telefone" value={selected.lead_phone} />
                <Info label="CNPJ" value={selected.lead_cnpj} />
                <Info label="Origem" value={[selected.source, selected.medium, selected.campaign].filter(Boolean).join(" / ")} />
                <Info label="Primeira visita" value={selected.first_seen ? format(new Date(selected.first_seen), "dd/MM/yyyy HH:mm") : null} />
                <Info label="Última visita" value={selected.last_seen ? format(new Date(selected.last_seen), "dd/MM/yyyy HH:mm") : null} />
              </div>

              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Página / interesse</TableHead>
                      <TableHead className="text-right">Pontos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{EVENT_LABELS[event.event_type] || event.event_type}</TableCell>
                        <TableCell className="max-w-[360px] truncate">
                          {event.entity_slug || event.path || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {event.score_delta > 0 ? `+${event.score_delta}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!eventsQuery.isLoading && events.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          Sem eventos registrados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
function Kpi({ title, value, icon: Icon }: { title: string; value: any; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{Number(value || 0)}</div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-medium break-all">{value || "—"}</div>
    </div>
  );
}
