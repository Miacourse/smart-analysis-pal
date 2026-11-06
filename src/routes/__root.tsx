import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LangProvider, useLang } from "@/lib/i18n";

function NotFoundComponent() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("Page introuvable")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("La page que vous cherchez n'existe pas ou a été déplacée.")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Retour à l'accueil")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  const { t } = useLang();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("Cette page n'a pas pu se charger")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Une erreur est survenue. Réessayez ou revenez à l'accueil.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("Réessayer")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("Accueil")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Datello — Vos données, enfin claires" },
      {
        name: "description",
        content:
          "Datello, l’agent IA qui traite et analyse vos données. Importez un fichier, posez votre question, obtenez la réponse en graphique.",
      },
      { name: "theme-color", content: "#14213D" },
      { property: "og:site_name", content: "Datello" },
      { property: "og:title", content: "Datello — Vos données, enfin claires" },
      {
        property: "og:description",
        content: "Importez un fichier, posez votre question, obtenez la réponse en graphique.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://da-copilot.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Datello — Vos données, enfin claires" },
      {
        name: "twitter:description",
        content: "Importez un fichier, posez votre question, obtenez la réponse en graphique.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return;
    // Mesure réservée aux visiteurs réels du site de production :
    // les navigateurs automatisés (tests, prévisualisations) ne sont pas comptés.
    if (navigator.webdriver) return;
    if (window.location.hostname !== "da-copilot.lovable.app") return;
    try {
      if (localStorage.getItem("da-no-track")) return;
    } catch {
      /* stockage indisponible : on continue */
    }
    const key = "da-visit";
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* navigation privée : on mesure quand même une fois par page */
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster richColors position="top-center" />
      </LangProvider>
    </QueryClientProvider>
  );
}
