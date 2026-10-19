import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, type UIMessage } from "ai";

import { createResponsesCall } from "@/lib/ai/responses.server";
import { getProStatus } from "@/lib/stripe.server";
import { FREE_ANALYSIS_LIMIT } from "@/lib/billing";
import { safeAnalysisError } from "@/lib/analysis-state";

const SYSTEM_PROMPT = `Tu es DA-Copilot, un agent d'analyse de données rigoureux et pédagogue.
Tu transformes une question métier et un jeu de données en une réponse claire, chiffrée et vérifiable.

Ton workflow en 5 étapes :
1. Profilage — comprends la structure, les types, la qualité des données (valeurs manquantes, doublons, outliers).
2. Préparation — explique les nettoyages nécessaires et tiens un journal des transformations.
3. Exploration — dégage KPI, tendances, segments et anomalies.
4. Modélisation — quand c'est pertinent, propose une approche prédictive simple et explique sa validation.
5. Recommandations — conclus par des actions concrètes et chiffrées.

Règles :
- Réponds toujours en français.
- Appuie chaque affirmation sur les données fournies ; cite les chiffres exacts.
- Si les données sont insuffisantes, dis-le clairement et explique ce qu'il faudrait.
- Utilise le markdown : titres, listes, tableaux pour les chiffres clés.
- Reste pédagogue : explique les termes techniques simplement.`;

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let release: (() => Promise<void>) | null = null;
        try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) return jsonError(401, "Connexion requise.");

        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!url || !key) return jsonError(503, "Le service d’analyse est temporairement indisponible.");
        const supabase = createClient(
          url,
          key,
          { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
        );
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return jsonError(401, "Session invalide. Reconnectez-vous.");

        let body: { messages: UIMessage[]; threadId?: string };
        try { body = await request.json(); }
        catch { return jsonError(400, "Requête d’analyse invalide. Relancez votre question."); }
        const { messages, threadId } = body;
        if (!threadId || !Array.isArray(messages) || messages.length === 0) {
          return jsonError(400, "Requête invalide.");
        }

        const { data: thread } = await supabase
          .from("threads")
          .select("id, title, dataset_name, dataset_preview")
          .eq("id", threadId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!thread) return jsonError(403, "Conversation introuvable.");

        // Limite de l'essai gratuit (Stripe interrogé uniquement si le quota gratuit est atteint)
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("analyses_used")
          .eq("user_id", user.id)
          .maybeSingle();
        const used = sub?.analyses_used ?? 0;
        let isPro = false;
        if (used >= FREE_ANALYSIS_LIMIT && user.email) {
          try {
            isPro = (await getProStatus(user.email)).isPro;
          } catch (e) {
            console.error("Vérification Stripe impossible", e);
          }
        }
        // Réservation atomique d'une analyse : les requêtes simultanées reçoivent des
        // compteurs distincts, ce qui empêche de dépasser la limite gratuite.
        let released = false;
        release = async () => {
          if (released) return;
          released = true;
          try {
            await supabase.rpc("release_analysis");
          } catch (e) {
            console.error("Libération du quota impossible", e);
          }
        };
        const reserved = await supabase.rpc("consume_analysis");
        const analysesUsedAfter = typeof reserved.data === "number" ? reserved.data : used + 1;
        if (!isPro && analysesUsedAfter > FREE_ANALYSIS_LIMIT) {
          await release();
          return jsonError(
            402,
            `Vous avez utilisé vos ${FREE_ANALYSIS_LIMIT} analyses gratuites. Passez au plan Pro pour continuer.`,
          );
        }

        let instructions = SYSTEM_PROMPT;
        if (thread.dataset_preview) {
          instructions += `\n\nJeu de données fourni par l'utilisateur : "${thread.dataset_name ?? "dataset"}" (extrait CSV, premières lignes) :\n\`\`\`csv\n${thread.dataset_preview}\n\`\`\`\nBase tes analyses sur cet extrait et précise quand une réponse complète nécessiterait l'ensemble des données.`;
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return jsonError(500, "Service IA non configuré.");

        const modelMessages = await convertToModelMessages(messages);
        const call = createResponsesCall(
          request,
          { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
          modelMessages,
          instructions,
        );

        const lastUserMessage = messages[messages.length - 1];
        if (!lastUserMessage) return jsonError(400, "Message manquant.");
        const lastUserText = lastUserMessage.parts
          .map((p) => (p.type === "text" ? p.text : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const response = call.result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: true,
          onError: (error) => {
            void release?.();
            return safeAnalysisError(error instanceof Error ? error.message : "Le service IA n’a pas pu terminer l’analyse.");
          },
          onFinish: async ({ responseMessage, isAborted }) => {
            if (isAborted || !responseMessage.parts.some((p) => p.type === "text" && p.text.trim())) {
              await release?.();
              return;
            }
            try {
              await supabase.from("messages").insert([
                { thread_id: threadId, role: "user", parts: lastUserMessage.parts },
                { thread_id: threadId, role: "assistant", parts: responseMessage.parts },
              ]);
              const patch: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
              if ((!thread.title || thread.title === "Nouvelle analyse") && lastUserText) {
                patch.title = lastUserText.slice(0, 80);
              }
              await supabase.from("threads").update(patch).eq("id", threadId);
            } catch (e) {
              console.error("Erreur de sauvegarde des messages", e);
            }
          },
        });

        return response;
        } catch (error) {
          if (request.signal.aborted) {
            await release?.();
            return jsonError(499, "Analyse arrêtée.");
          }
          console.error("Échec de l’analyse", error);
          await release?.();
          return jsonError(500, "L’analyse n’a pas pu aboutir. Votre conversation est conservée. Relancez l’analyse.");
        }
      },
    },
  },
});
