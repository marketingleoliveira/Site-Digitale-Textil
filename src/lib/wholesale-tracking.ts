import { trackEvent } from "@/lib/tracking";

export type WholesaleEvent =
  | "wholesale_landing_view"
  | "wholesale_whatsapp_click"
  | "wholesale_quote_click"
  | "wholesale_sample_click"
  | "wholesale_catalog_click";

type WholesaleEventData =
  Record<
    string,
    string | number | boolean | undefined
  >;

export function trackWholesaleEvent(
  event: WholesaleEvent,
  data: WholesaleEventData = {}
) {

  if (
    typeof window === "undefined"
  ) {
    return;
  }

  const internalPage =
    String(
      data.page
      || window.location.pathname
    );


  void trackEvent(
    event,
    {
      entityType:
        "wholesale",

      entitySlug:
        internalPage,

      metadata: {
        funnel:
          "atacado",

        ...data
      }
    }
  );


  const w =
    window as any;

  w.dataLayer =
    w.dataLayer || [];

  w.dataLayer.push({
    event,
    business_area:
      "tecidos_atacado",
    ...data
  });

  if (
    typeof w.gtag ===
      "function"
  ) {

    w.gtag(
      "event",
      event,
      {
        business_area:
          "tecidos_atacado",

        ...data
      }
    );


    if (
      event ===
        "wholesale_whatsapp_click"
      ||
      event ===
        "wholesale_quote_click"
      ||
      event ===
        "wholesale_sample_click"
    ) {

      w.gtag(
        "event",
        "generate_lead",
        {
          lead_source:
            "site_digitale_atacado",

          ...data
        }
      );
    }
  }
}
