import { describe, expect, it, vi } from "vitest";
import { analysisFetch, estimatedProgress, safeAnalysisError, showLongAnalysisNotice } from "@/lib/analysis-state";

describe("analysis processing", () => {
  it.each([['upload', 0, 25], ['parsing', 25, 50], ['ai', 50, 90], ['charts', 90, 100]] as const)("keeps %s in its actual stage", (phase, min, max) => {
    expect(estimatedProgress(phase, 0)).toBe(min);
    expect(estimatedProgress(phase, 60000)).toBeGreaterThan(min);
    expect(estimatedProgress(phase, 60000)).toBeLessThan(max);
  });
  it("shows the delay notice only after 10 seconds", () => {
    expect(showLongAnalysisNotice(10000)).toBe(false);
    expect(showLongAnalysisNotice(10001)).toBe(true);
  });
  it("does not expose an HTML error document", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html><html>failure</html>", { status: 500, headers: { 'content-type': 'text/html' } })));
    try {
      const result = await analysisFetch('/api/chat');
      expect(result.status).toBe(500);
      expect(result.headers.get('content-type')).toContain('application/json');
      expect((await result.json()).error).not.toContain('<');
      expect(safeAnalysisError('{"error":"Insufficient credits"}')).toContain('indisponible');
      expect(safeAnalysisError("Payment Required")).toContain('indisponible');
      expect(safeAnalysisError("Vous avez utilisé vos 5 analyses gratuites. Passez au plan Pro pour continuer.")).toContain('analyses gratuites');
    } finally { vi.unstubAllGlobals(); }
  });

  it("replaces raw provider retry errors with a clear message", () => {
    expect(safeAnalysisError("Failed after 3 attempts. Last error: AI_APICallError: <none>")).toContain("indisponible");
    expect(safeAnalysisError("AI_APICallError: Internal error encountered")).toContain("indisponible");
    expect(safeAnalysisError("PERMISSION_DENIED: API_KEY_HTTP_REFERRER_BLOCKED")).toContain("indisponible");
  });
});