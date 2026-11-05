import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { requestErrorResponse } from "./lib/http-error";
import { getRequest, setResponseHeaders } from "@tanstack/react-start/server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { SECURITY_HEADERS } from "./lib/security-headers";

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  try {
    setResponseHeaders(SECURITY_HEADERS as never);
  } catch {
    // server.ts ajoute les en-têtes si le contexte de réponse n'est plus disponible.
  }
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return requestErrorResponse(getRequest());
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware, csrfMiddleware],
}));
