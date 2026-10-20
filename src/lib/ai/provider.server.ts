import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createResponsesCall } from "./responses.server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const LOVABLE_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const FREE_BASE_URL = "https://text.pollinations.ai/openai";

export type AiProvider =
  | "gemini"
  | "anthropic"
  | "openrouter"
  | "openai"
  | "free"
  | "lovable";

function geminiKey() {
  return process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ?? null;
}

function anthropicKey() {
  return process.env["ANTHROPIC_API_KEY"] ?? process.env["CLAUDE_API_KEY"] ?? null;
}

function openrouterKey() {
  return process.env["OPENROUTER_API_KEY"] ?? null;
}

function openaiKey() {
  return process.env["OPENAI_API_KEY"] ?? null;
}

/**
 * Fournisseur actif : Gemini, Claude ou OpenAI si une clé est fournie, sinon un point
 * d'accès gratuit sans clé (dépannage). `AI_PROVIDER` force un fournisseur précis.
 */
export function activeProvider(): AiProvider {
  const forced = (process.env["AI_PROVIDER"] ?? "").trim().toLowerCase();
  if (forced === "gemini" && geminiKey()) return "gemini";
  if (forced === "anthropic" && anthropicKey()) return "anthropic";
  if (forced === "openrouter" && openrouterKey()) return "openrouter";
  if (forced === "openai" && openaiKey()) return "openai";
  if (forced === "lovable" && process.env["LOVABLE_API_KEY"]) return "lovable";
  if (geminiKey()) return "gemini";
  if (anthropicKey()) return "anthropic";
  if (openrouterKey()) return "openrouter";
  if (openaiKey()) return "openai";
  return "free";
}

function chatProvider(baseURL: string, apiKey: string, rewrite?: boolean) {
  return createOpenAI({
    baseURL,
    apiKey,
    ...(rewrite
      ? {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => {
            const raw =
              typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            // Le point d'accès gratuit expose déjà /openai comme endpoint de chat :
            // on retire le suffixe ajouté par le SDK.
            const url = raw.replace(/\/chat\/completions\/?(\?.*)?$/i, "");
            return fetch(url, init);
          },
        }
      : {}),
  });
}

/** Construit l'appel d'analyse avec le fournisseur disponible. */
export function createAnalysisCall(
  request: Request,
  messages: ModelMessage[],
  instructions?: string,
) {
  const provider = activeProvider();

  if (provider === "gemini") {
    const google = chatProvider(GEMINI_BASE_URL, geminiKey()!);
    const model = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";
    return {
      provider,
      result: streamText({
        model: google.chat(model),
        ...(instructions ? { instructions } : {}),
        messages,
        abortSignal: request.signal,
      }),
    };
  }

  if (provider === "anthropic") {
    // Couche de compatibilité OpenAI d'Anthropic : même SDK, base URL et clé Claude.
    const anthropic = chatProvider(ANTHROPIC_BASE_URL, anthropicKey()!);
    const model = process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6";
    const maxOutputTokens = Number(process.env["ANTHROPIC_MAX_TOKENS"] ?? 4096);
    return {
      provider,
      result: streamText({
        model: anthropic.chat(model),
        ...(Number.isFinite(maxOutputTokens) ? { maxOutputTokens } : {}),
        ...(instructions ? { instructions } : {}),
        messages,
        abortSignal: request.signal,
      }),
    };
  }

  if (provider === "openrouter") {
    const openrouter = createOpenAI({
      baseURL: OPENROUTER_BASE_URL,
      apiKey: openrouterKey()!,
      headers: {
        "HTTP-Referer":
          process.env["OPENROUTER_SITE_URL"] ?? "https://smart-analysis-pal.lovable.app",
        "X-Title": "DA-Copilot",
      },
    });
    const model = process.env["OPENROUTER_MODEL"] ?? "nvidia/nemotron-3-super-120b-a12b:free";
    const maxOutputTokens = Number(process.env["OPENROUTER_MAX_TOKENS"] ?? 4096);
    return {
      provider,
      result: streamText({
        model: openrouter.chat(model),
        ...(Number.isFinite(maxOutputTokens) ? { maxOutputTokens } : {}),
        ...(instructions ? { instructions } : {}),
        messages,
        abortSignal: request.signal,
      }),
    };
  }

  if (provider === "openai") {
    const openai = chatProvider("https://api.openai.com/v1", openaiKey()!);
    const model = process.env["OPENAI_MODEL"] ?? "gpt-4o";
    return {
      provider,
      result: streamText({
        model: openai.chat(model),
        ...(instructions ? { instructions } : {}),
        messages,
        abortSignal: request.signal,
      }),
    };
  }

  if (provider === "free") {
    const baseURL = (process.env["FREE_AI_BASE_URL"] ?? FREE_BASE_URL).replace(/\/+$/, "");
    const free = chatProvider(baseURL, process.env["FREE_AI_API_KEY"] ?? "anonymous", true);
    const model = process.env["FREE_AI_MODEL"] ?? "openai";
    const maxOutputTokens = Number(process.env["FREE_AI_MAX_TOKENS"] ?? 6000);
    return {
      provider,
      result: streamText({
        model: free.chat(model),
        // Ce point d'accès plafonne par défaut à ~400 tokens (raisonnement inclus) :
        // on relève le budget et on limite le raisonnement interne pour que le texte
        // de la réponse ne soit pas coupé.
        ...(Number.isFinite(maxOutputTokens) ? { maxOutputTokens } : {}),
        providerOptions: { openai: { reasoningEffort: "low" } },
        ...(instructions ? { instructions } : {}),
        messages,
        abortSignal: request.signal,
      }),
    };
  }

  // Passerelle Lovable (comportement historique, avec suivi du run-id).
  return {
    provider,
    result: createResponsesCall(
      request,
      {
        baseURL: LOVABLE_BASE_URL,
        apiKey: process.env["LOVABLE_API_KEY"]!,
        model: "openai/gpt-6-astra",
      },
      messages,
      instructions,
    ).result,
  };
}
