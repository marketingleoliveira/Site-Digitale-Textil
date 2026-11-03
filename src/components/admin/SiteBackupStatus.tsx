import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

type BackupStatus = {
  repository?: string;
  lastAttemptAt?: string | null;
  lastRunSuccessful?: boolean;
  lastSuccessAt?: string | null;
  commit?: string | null;
  error?: string | null;
};

const allowedEmails = new Set([
  "marketing@digitaletextil.com.br",
  "marketing2@digitaletextil.com.br",
]);

function formatDate(value?: string | null) {
  if (!value) return "Não confirmado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Não confirmado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function SiteBackupStatus() {
  const { user, isAdmin } = useAuth();

  const email = user?.email?.trim().toLowerCase();

  const authorized =
    isAdmin && Boolean(email && allowedEmails.has(email));

  const [data, setData] = useState<BackupStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!authorized) return;

    let mounted = true;

    async function refresh() {
      try {
        const response = await fetch(
          "/site-backup-status.json?t=" + Date.now(),
          { cache: "no-store" }
        );

        if (!response.ok) throw new Error("HTTP");

        const result = await response.json();

        if (
          result.repository !==
          "marketingleoliveira/Site-Digitale-Textil"
        ) {
          throw new Error("Repositório incorreto");
        }

        if (mounted) {
          setData(result);
          setUnavailable(false);
        }
      } catch {
        if (mounted) setUnavailable(true);
      }
    }

    void refresh();

    const timer = window.setInterval(refresh, 60000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [authorized]);

  if (!authorized) return null;

  const failed = data?.lastRunSuccessful === false;
  const successful = data?.lastRunSuccessful === true;

  const status = unavailable
    ? "Indisponível"
    : failed
      ? "Falha na última tentativa"
      : successful
        ? "Confirmado"
        : "Não confirmado";

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[290px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm font-semibold text-foreground">
          Backup automático
        </strong>

        <span
          className={
            "text-xs font-semibold " +
            (successful && !unavailable
              ? "text-emerald-600"
              : "text-amber-600")
          }
        >
          {status}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p>
          Último envio:{" "}
          {unavailable
            ? "Indisponível"
            : formatDate(data?.lastSuccessAt)}
        </p>

        {!unavailable && data?.commit && (
          <p>Commit: {data.commit.slice(0, 12)}</p>
        )}

        {!unavailable && failed && (
          <p className="text-amber-600">
            Última tentativa: {formatDate(data?.lastAttemptAt)}
          </p>
        )}

        <p>Agendamento: diariamente às 18h</p>
      </div>
    </div>
  );
}
