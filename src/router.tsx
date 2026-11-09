import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const CHUNK_RELOAD_KEY = "da-chunk-reload-at";
let chunkGuardInstalled = false;

function installChunkReloadGuard() {
  if (typeof window === "undefined" || chunkGuardInstalled) return;
  chunkGuardInstalled = true;
  window.addEventListener("vite:preloadError", () => {
    try {
      const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
      if (Date.now() - last < 10_000) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    } catch {
      // stockage indisponible : on recharge une fois quand même
    }
    window.location.reload();
  });
}

export const getRouter = () => {
  installChunkReloadGuard();
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
