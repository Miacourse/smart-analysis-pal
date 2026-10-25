import { createFileRoute } from "@tanstack/react-router";

const COUNTRY_HEADERS = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-country-code",
  "x-geo-country",
  "x-appengine-country",
];

const BOT =
  /bot|crawler|spider|preview|lighthouse|headless|playwright|puppeteer|curl|wget|python-requests/i;

export const Route = createFileRoute("/api/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ua = request.headers.get("user-agent") ?? "";
          if (BOT.test(ua)) return new Response(null, { status: 204 });
          if (/headless/i.test(request.headers.get("sec-ch-ua") ?? "")) {
            return new Response(null, { status: 204 });
          }

          let country: string | null = null;
          for (const header of COUNTRY_HEADERS) {
            const value = request.headers.get(header);
            if (value && /^[A-Za-z]{2}$/.test(value)) {
              country = value.toUpperCase();
              break;
            }
          }

          let path = "/";
          let referrer: string | null = null;
          try {
            const body = (await request.json()) as { path?: unknown; referrer?: unknown };
            if (typeof body?.path === "string") path = body.path.slice(0, 200);
            if (typeof body?.referrer === "string") referrer = body.referrer.slice(0, 300);
          } catch {
            /* body optionnel */
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("app_visits" as never).insert({
            path,
            country,
            referrer,
          } as never);
        } catch {
          /* le suivi ne doit jamais casser la navigation */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
