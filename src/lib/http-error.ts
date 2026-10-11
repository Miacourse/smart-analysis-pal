import { renderErrorPage } from "./error-page";

export function requestErrorResponse(request: Request) {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/") || path.startsWith("/_serverFn/")) {
    return Response.json({ error: "Le traitement n’a pas pu aboutir. Réessayez dans quelques instants." }, { status: 500 });
  }
  return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}