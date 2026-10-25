import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, type UIMessage } from "ai";

import { createAnalysisCall } from "@/lib/ai/provider.server";
import { getProStatus } from "@/lib/stripe.server";
import { activeCompPlan, FREE_ANALYSIS_LIMIT } from "@/lib/billing";
import { safeAnalysisError } from "@/lib/analysis-state";
import { formatProfileForPrompt, type DatasetProfile } from "@/lib/dataset-profile";
import { getAnalysisDomain } from "@/lib/analysis-domains";

const SYSTEM_PROMPT = `Tu es DA-Copilot, un agent d'analyse de données rigoureux et pédagogue.
Tu transformes une question métier et un jeu de données en une réponse claire, chiffrée et vérifiable.

Ton workflow en 5 étapes :
1. Profilage — comprends la structure, les types, la qualité des données (valeurs manquantes, doublons, outliers).
2. Préparation — explique les nettoyages nécessaires et tiens un journal des transformations.
3. Exploration — dégage KPI, tendances, segments et anomalies.
4. Modélisation — quand c'est pertinent, propose une approche prédictive simple et explique sa validation.
5. Recommandations — conclus par des actions concrètes et chiffrées.

Règles :
- Réponds dans la langue de la dernière question de l'utilisateur (français par défaut). Si la question est en anglais, en espagnol, en arabe, etc., réponds dans cette langue. Traduis aussi les noms de colonnes et libellés du fichier dans cette langue quand c'est utile, sans inventer de valeurs.
- Appuie chaque affirmation sur les données fournies ; cite les chiffres exacts.
- Si les données sont insuffisantes, dis-le clairement et explique ce qu'il faudrait.
- Utilise le markdown : titres, listes, tableaux pour les chiffres clés.
- Style de rapport professionnel : phrases complètes, ponctuation simple, ton factuel. N'utilise ni tiret long (—), ni flèche (→), ni émoji, ni symbole décoratif (✨, ✅, ⚠️), ni guillemets courbes.
- Reste pédagogue : explique les termes techniques simplement.
- Ne joins jamais de section « Note sur l'exportation PDF » et ne demande jamais d'utiliser Ctrl+P : les exports PDF et Excel se font uniquement via les boutons de l'interface.
- OBLIGATOIRE : dès que le fichier contient au moins une colonne numérique, ajoute EN PLUS du texte au moins un bloc \`\`\`chart contenant uniquement du JSON valide (≤ 300 Ko, données agrégées, nombres bruts). Un tableau markdown ne remplace pas le graphique. Choisis le moteur adapté :
  • "recharts" — comparer quelques catégories : {"engine":"recharts","type":"bar|line|area|pie|scatter","title":"...","xKey":"...","yKeys":["..."],"data":[...]} (30 points max ; pie/scatter : un seul yKey).
  • "vega" — statistiques (histogramme, boxplot, densité, heatmap, facettes, régression) : {"engine":"vega","title":"...","vegaSpec":{...spec Vega-Lite v6 complète, avec "data":{"values":[...]}}}
  • "plotly" — scientifique (contours, heatmap, 3D, surface, ternaire, cartes lat/lon, nuages denses) : {"engine":"plotly","title":"...","traces":[...],"layout":{...}}
  Exemples :
\`\`\`chart
{"engine":"recharts","type":"bar","title":"Taux de survie par classe","xKey":"Classe","yKeys":["Taux de survie"],"data":[{"Classe":"1","Taux de survie":63},{"Classe":"2","Taux de survie":47},{"Classe":"3","Taux de survie":24}]}
\`\`\`
\`\`\`chart
{"engine":"plotly","title":"Diagramme ternaire","traces":[{"type":"scatterternary","mode":"markers","a":[70,50,20],"b":[20,30,40],"c":[10,20,40],"text":["A","B","C"]}],"layout":{"ternary":{"sum":100}}}
\`\`\`
\`\`\`chart
{"engine":"plotly","title":"Carte des stations","traces":[{"type":"scattergeo","mode":"markers","lat":[48.85,45.76],"lon":[2.35,4.83],"text":["Paris","Lyon"]}],"layout":{"geo":{"scope":"europe"}}}
\`\`\`
  N'ajoute pas de graphique seulement si aucune colonne numérique n'existe. Produis autant de blocs que l'analyse le justifie (classement, tendance, répartition, corrélation, anomalie, comparaison, saisonnalité), un par idée clé et sans doublon : le nombre de graphiques dépend des données et des questions, pas d'un plafond fixe. Le titre de chaque graphique doit être explicite et issu de la compréhension des données, du métier et de la question : cite l'indicateur et la dimension analysés (par exemple « Sessions par ville, top 10 » ou « Taux d'engagement par canal »), jamais un titre générique comme « Graphique 1 ». Chaque bloc doit contenir uniquement du JSON valide, sans commentaire autour du JSON.`;

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

        let body: { messages: UIMessage[]; threadId?: string; domain?: string };
        try { body = await request.json(); }
        catch { return jsonError(400, "Requête d’analyse invalide. Relancez votre question."); }
        const { messages, threadId, domain: domainId } = body;
        if (!threadId || !Array.isArray(messages) || messages.length === 0) {
          return jsonError(400, "Requête invalide.");
        }

        const { data: thread } = await supabase
          .from("threads")
          .select("id, title, dataset_name, dataset_preview, dataset_profile, dataset_rows")
          .eq("id", threadId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!thread) return jsonError(403, "Conversation introuvable.");

        // Limite de l'essai gratuit (Stripe interrogé uniquement si le quota gratuit est atteint)
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("analyses_used, comp_plan, comp_expires_at, bonus_analyses")
          .eq("user_id", user.id)
          .maybeSingle();
        const used = sub?.analyses_used ?? 0;
        const bonus = sub?.bonus_analyses ?? 0;
        const freeLimit = FREE_ANALYSIS_LIMIT + bonus;
        // Les administrateurs disposent d'un accès illimité et ne consomment pas de quota.
        const { data: adminFlag } = await supabase.rpc("has_role", {
          _user_id: user.id,
          _role: "admin",
        });
        const isAdmin = adminFlag === true;
        let isPro = isAdmin || activeCompPlan(sub?.comp_plan, sub?.comp_expires_at) !== null;
        if (!isPro && used >= freeLimit && user.email) {
          try {
            isPro = (await getProStatus(user.email)).isPro;
          } catch (e) {
            console.error("Vérification Stripe impossible", e);
          }
        }
        // Réservation atomique d'une analyse : les requêtes simultanées reçoivent des
        // compteurs distincts, ce qui empêche de dépasser la limite gratuite.
        let released = false;
        const releaseQuota = async () => {
          if (released) return;
          released = true;
          try {
            await supabase.rpc("release_analysis");
          } catch (e) {
            console.error("Libération du quota impossible", e);
          }
        };
        if (!isAdmin) {
          release = releaseQuota;
          const reserved = await supabase.rpc("consume_analysis");
          const analysesUsedAfter = typeof reserved.data === "number" ? reserved.data : used + 1;
          if (!isPro && analysesUsedAfter > freeLimit) {
            await release();
            return jsonError(
              402,
              `Vous avez utilisé vos ${freeLimit} analyses gratuites. Passez au plan Pro pour continuer.`,
            );
          }
        }

        const firstUserText = messages
          .find((message) => message.role === "user")
          ?.parts.map((p) => (p.type === "text" ? p.text : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if ((!thread.title || thread.title === "Nouvelle analyse") && firstUserText) {
          await supabase
            .from("threads")
            .update({ title: firstUserText.slice(0, 50) })
            .eq("id", threadId);
        }

        let instructions = SYSTEM_PROMPT;
        const domainConfig = getAnalysisDomain(domainId);
        instructions += `\n\nMODE D'ANALYSE ACTIF : ${domainConfig.label}.\n${domainConfig.prompt}`;
        let profileApplied = false;
        if (thread.dataset_profile) {
          try {
            const profile = JSON.parse(thread.dataset_profile) as DatasetProfile;
            const totalRows = thread.dataset_rows ?? profile.rows;
            const profiled = profile.profiledRows ?? profile.rows;
            const scope =
              profiled >= totalRows
                ? `Le profil statistique couvre l'INTÉGRALITÉ du fichier (${totalRows.toLocaleString("fr-FR")} lignes)`
                : `Le fichier contient ${totalRows.toLocaleString("fr-FR")} lignes ; le profil statistique est calculé sur un échantillon régulier de ${profiled.toLocaleString("fr-FR")} lignes, et l'extrait ci-dessous sert d'illustration`;
            instructions += `\n\nJeu de données fourni par l'utilisateur : "${thread.dataset_name ?? "dataset"}". ${scope}. Ne prétends jamais que seules quelques lignes sont disponibles.\n\n\`\`\`\n${formatProfileForPrompt(profile)}\n\`\`\`\n\nQualité des données : appuie-toi sur les indicateurs du profil (cellules vides, doublons, valeurs non numériques, valeurs aberrantes selon l'IQR, colonnes constantes, espaces parasites). Signale chaque problème détecté, chiffre-le, explique son impact et propose une correction (imputation, conversion, plafonnement, dédoublonnage) sans jamais modifier les données en silence. Précise quand une vue ligne à ligne serait nécessaire.`;
            profileApplied = true;
          } catch (error) {
            console.error("Profil de données illisible", error);
          }
        }
        if (!profileApplied && thread.dataset_preview) {
          instructions += `\n\nJeu de données fourni par l'utilisateur : "${thread.dataset_name ?? "dataset"}" (extrait CSV, premières lignes) :\n\`\`\`csv\n${thread.dataset_preview}\n\`\`\`\nBase tes analyses sur cet extrait et précise quand une réponse complète nécessiterait l'ensemble des données.`;
        }

        const modelMessages = await convertToModelMessages(messages);
        const call = createAnalysisCall(request, modelMessages, instructions);
        if (!call) {
          await release?.();
          return jsonError(500, "Service IA non configuré.");
        }

        const lastUserMessage = messages[messages.length - 1];
        if (!lastUserMessage) return jsonError(400, "Message manquant.");
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
              await supabase
                .from("threads")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", threadId);
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
