import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  getTrackingSessionId,
  trackEvent,
  trackingEntityFromPath,
} from "@/lib/tracking";

const SESSION_SENT_KEY = "digitale_tracking_session_sent";

export function TrackingPixel() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;

    /* DIGITALE_GA4_SPA_V1 */
    const googleWindow =
      window as any;

    if (
      typeof googleWindow.gtag
      === "function"
    ) {

      googleWindow.gtag(
        "event",
        "page_view",
        {
          page_location:
            window.location.href,

          page_path:
            location.pathname
            + location.search
        }
      );
    }

    const entity = trackingEntityFromPath(location.pathname);

    if (!sessionStorage.getItem(SESSION_SENT_KEY)) {
      sessionStorage.setItem(SESSION_SENT_KEY, getTrackingSessionId());
      void trackEvent("session_start", entity);
    }

    const pageTimer = window.setTimeout(() => {
      void trackEvent("page_view", entity);
    }, 100);

    const engagementTimer = window.setTimeout(() => {
      void trackEvent("engaged_60s", {
        ...entity,
        metadata: { seconds: 60 },
      });
    }, 60000);

    return () => {
      window.clearTimeout(pageTimer);
      window.clearTimeout(engagementTimer);
    };
  }, [location.pathname, location.search]);

  return null;
}
