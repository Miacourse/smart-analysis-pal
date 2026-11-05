export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://*.lovable.app https://*.lovableproject.com https://*.lovableproject-dev.com https://gptengineer.app https://*.gptengineer.app",
};

/**
 * Ajoute les en-têtes de sécurité sans perdre les cookies multiples (Set-Cookie).
 * Les réponses normales passent par le middleware de start.ts ; ce wrapper sert
 * de filet de sécurité pour les erreurs catastrophiques du serveur.
 */
export function withSecurityHeaders(response: Response): Response {
  if (Object.keys(SECURITY_HEADERS).every((name) => response.headers.has(name))) return response;

  const headers = new Headers();
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "set-cookie") headers.set(name, value);
  });
  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  const cookies = typeof getSetCookie === "function" ? getSetCookie.call(response.headers) : [];
  if (cookies.length > 0) {
    for (const cookie of cookies) headers.append("set-cookie", cookie);
  } else {
    const cookie = response.headers.get("set-cookie");
    if (cookie) headers.set("set-cookie", cookie);
  }
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
