import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "@/lib/rate-limit.server";
import { readJsonBody } from "@/lib/request-body.server";
import { withSecurityHeaders } from "@/lib/security-headers";

describe("security helpers", () => {
  it("ajoute les en-têtes de sécurité sans perdre les cookies", () => {
    const response = new Response("ok", {
      headers: {
        "Set-Cookie": "session=abc; Path=/",
        "X-Test": "1",
      },
    });

    const wrapped = withSecurityHeaders(response);

    expect(wrapped.headers.get("x-content-type-options")).toBe("nosniff");
    expect(wrapped.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(wrapped.headers.get("content-security-policy")).toContain("frame-ancestors");
    expect(wrapped.headers.get("set-cookie")).toContain("session=abc");
    expect(wrapped.headers.get("x-test")).toBe("1");
  });

  it("refuse un corps JSON au-delà de la limite", async () => {
    const ok = new Request("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(ok, 1024)).resolves.toEqual({ ok: true });

    const tooBig = new Request("http://localhost/api", {
      method: "POST",
      body: "x".repeat(2048),
    });
    await expect(readJsonBody(tooBig, 1024)).resolves.toBeNull();
  });

  it("bloque les requêtes après la limite", () => {
    const key = `test:${Date.now()}:${Math.random()}`;

    expect(consumeRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000).allowed).toBe(true);

    const blocked = consumeRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});
