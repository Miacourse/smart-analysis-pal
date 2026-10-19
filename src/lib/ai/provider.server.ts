import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createResponsesCall } from "./responses.server";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const LOVABLE_BASE_URL = "https://ai.gateway.lovable.dev/v1";

export type AiProvider = "gemini" | "openai" | "lovable";

function geminiKey() {
  return process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ?? null;
}

function openaiKey() {
  return process.env["OPENAI_API_KEY"] ?? null;
}

/** Fournisseur actif, déterminé par la clé disponible (Gemini prioritaire, puis OpenAI, puis Lovable). */
export function activeProvider(): AiProvider | null {
  if (geminiKey()) return "gemini";
  if (openaiKey()) return "openai";
  if (process.env["LOVABLE_API_KEY"]) return "lovable";
  return null;
}

/**
 * Construit l'appel d'analyse avec le fournisseur disponible.
 * Renvoie null si aucune clé n'est configurée.
 */
export function createAnalysisCall(
  request: Request,
  messages: ModelMessage[],
  instructions?: string,
) {
  const provider = activeProvider();
  if (!provider) return null;

  if (provider === "gemini") {
    const google = createOpenAI({ baseURL: GEMINI_BASE_URL, apiKey: geminiKey()! });
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

  if (provider === "openai") {
    const openai = createOpenAI({ apiKey: openaiKey()! });
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

  // Passerelle Lovable (comportement historique, avec suivi du run-id).
  return {
    provider,
    result: createResponsesCall(
      request,
      { baseURL: LOVABLE_BASE_URL, apiKey: process.env["LOVABLE_API_KEY"]!, model: "openai/gpt-6-astra" },
      messages,
      instructions,
    ).result,
  };
}
