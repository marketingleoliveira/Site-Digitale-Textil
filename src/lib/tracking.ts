const VISITOR_KEY = "digitale_tracking_visitor";
const SESSION_KEY = "digitale_tracking_session";
const ATTRIBUTION_KEY = "digitale_tracking_attribution";

type TrackingIdentity = {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  cnpj?: string;
};

type TrackingOptions = {
  entityType?: string;
  entitySlug?: string;
  metadata?: Record<string, unknown>;
  identity?: TrackingIdentity;
};

function uuid(prefix: string) {
  const value =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value}`;
}
function getStored(storage: Storage, key: string, prefix: string) {
  let value = storage.getItem(key);
  if (!value) {
    value = uuid(prefix);
    storage.setItem(key, value);
  }
  return value;
}

export function getTrackingVisitorKey() {
  if (typeof window === "undefined") return "";
  return getStored(localStorage, VISITOR_KEY, "v");
}

export function getTrackingSessionId() {
  if (typeof window === "undefined") return "";
  return getStored(sessionStorage, SESSION_KEY, "s");
}

function getAttribution() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const current = {
    source: params.get("utm_source") || null,
    medium: params.get("utm_medium") || null,
    campaign: params.get("utm_campaign") || null,
    referrer: document.referrer || null,
  };
  try {
    const existing = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "null");
    if (existing) return existing;
    if (current.source || current.medium || current.campaign || current.referrer) {
      localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current));
    }
  } catch {}
  return current;
}

function browserName() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Outro";
}

function deviceType() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function trackEvent(
  eventType: string,
  options: TrackingOptions = {}
) {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/admin")) return;
  const attribution = getAttribution();
  const path = window.location.pathname + window.location.search;

  const payload = {
    visitor_key: getTrackingVisitorKey(),
    session_id: getTrackingSessionId(),
    event_type: eventType,
    path,
    page_title: document.title || null,
    entity_type: options.entityType || null,
    entity_slug: options.entitySlug || null,
    metadata: options.metadata || {},
    identity: options.identity || null,
    source: attribution.source || null,
    medium: attribution.medium || null,
    campaign: attribution.campaign || null,
    referrer: attribution.referrer || null,
    device_type: deviceType(),
    browser: browserName(),
    language: navigator.language || null,
  };

  try {

    const response =
      await fetch(
        "/api/tracking/event",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            ),

          keepalive:
            true,
        }
      );


    return response.ok;

  } catch {

    // Tracking nunca deve interromper
    // a experiência do visitante.

    return false;
  }
}
export function identifyAndTrack(
  eventType: string,
  identity: TrackingIdentity,
  options: Omit<TrackingOptions, "identity"> = {}
) {
  return trackEvent(eventType, {
    ...options,
    identity,
  });
}

export function trackingEntityFromPath(pathname: string) {
  const fabric = pathname.match(/^\/tecidos\/([^/]+)/);
  if (fabric) {
    return {
      entityType: "fabric",
      entitySlug: decodeURIComponent(fabric[1]),
    };
  }
  if (
    pathname === "/atacado"
    ||
    pathname.startsWith(
      "/tecido-fitness-atacado"
    )
    ||
    pathname.startsWith(
      "/tecido-poliamida-atacado"
    )
    ||
    pathname.startsWith(
      "/tecido-moda-praia-atacado"
    )
  ) {

    return {
      entityType:
        "wholesale_page",

      entitySlug:
        pathname
          .replace(
            /^\//,
            ""
          )
          || "atacado"
    };
  }


  if (pathname.startsWith("/tecnologias")) {
    return { entityType: "technology_page", entitySlug: "tecnologias" };
  }
  if (pathname.startsWith("/segmentos")) {
    return { entityType: "segment_page", entitySlug: pathname.split("/")[2] || "segmentos" };
  }
  return {};
}
