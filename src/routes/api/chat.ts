import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, type UIMessage } from "ai";

import { createResponsesCall } from "@/lib/ai/responses.server";

const FREE_MESSAGE_LIMIT = 20;

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
        const authHeader = request.headers.get("authorization");
        if (!authHeader) return jsonError(401, "Connexion requise.");

        const supabase = createClient(
          process.env["SUPABASE_URL"]!,
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return jsonError(401, "Session invalide. Reconnectez-vous.");

        const body = (await request.json()) as { messages: UIMessage[]; threadId?: string };
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

        // Limite du plan gratuit
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan, analyses_used")
          .eq("user_id", user.id)
          .maybeSingle();
        const plan = sub?.plan ?? "free";
        const used = sub?.analyses_used ?? 0;
        if (plan === "free" && used >= FREE_MESSAGE_LIMIT) {
          return jsonError(
            402,
            `Vous avez atteint la limite du plan gratuit (${FREE_MESSAGE_LIMIT} analyses). Passez au plan Pro pour continuer.`,
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
        const response = call.result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: true,
          onFinish: async ({ responseMessage }) => {
            try {
              await supabase.from("messages").insert([
                { thread_id: threadId, role: "user", parts: lastUserMessage.parts },
                { thread_id: threadId, role: "assistant", parts: responseMessage.parts },
              ]);
              await supabase
                .from("threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
              if (sub) {
                await supabase
                  .from("subscriptions")
                  .update({ analyses_used: used + 1, updated_at: new Date().toISOString() })
                  .eq("user_id", user.id);
              } else {
                await supabase
                  .from("subscriptions")
                  .insert({ user_id: user.id, analyses_used: 1 });
              }
            } catch (e) {
              console.error("Erreur de sauvegarde des messages", e);
            }
          },
        });

        return response;
      },
    },
  },
});
