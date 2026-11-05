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

const MAX_BODY_BYTES = 4_096;

function clientIp(request: Request): string {
  const trusted = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  if (trusted) return trusted.trim().slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return "unknown";
}

function cleanPath(value: string): string {
  const path = value.replace(/\p{Cc}/gu, "").slice(0, 200);
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function cleanReferrer(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

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

          const { consumeRateLimit } = await import("@/lib/rate-limit.server");
          const rate = consumeRateLimit(`track:${clientIp(request)}`, 60, 60_000);
          if (!rate.allowed) return new Response(null, { status: 204 });

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
          const { readJsonBody } = await import("@/lib/request-body.server");
          const body = await readJsonBody(request, MAX_BODY_BYTES);
          if (body && typeof body === "object") {
            const payload = body as { path?: unknown; referrer?: unknown };
            if (typeof payload.path === "string") path = cleanPath(payload.path);
            if (typeof payload.referrer === "string") referrer = cleanReferrer(payload.referrer);
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
