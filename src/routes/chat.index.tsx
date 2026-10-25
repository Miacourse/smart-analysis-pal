import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ChatShell } from "@/components/chat/chat-shell";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/chat/")({
  head: () => ({
    meta: [
      { title: "Mes analyses — DA-Copilot" },
      { name: "description", content: "Vos conversations d'analyse de données." },
      { property: "og:title", content: "Mes analyses — DA-Copilot" },
      { property: "og:description", content: "Retrouvez votre espace d’analyse de données et vos conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      // Ouvre la conversation la plus récente, sinon en crée une.
      const { data: threads } = await supabase
        .from("threads")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const latest = threads?.[0];
      if (latest) {
        navigate({ to: "/chat/$threadId", params: { threadId: latest.id }, replace: true });
      } else {
        const { data, error } = await supabase
          .from("threads")
          .insert({ user_id: session.user.id })
          .select("id")
          .single();
        if (!cancelled && data && !error) {
          navigate({ to: "/chat/$threadId", params: { threadId: data.id }, replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <ChatShell>
      <div className="flex flex-1 items-center justify-center">
        <Shimmer className="text-sm">Ouverture de votre espace d'analyse…</Shimmer>
      </div>
    </ChatShell>
  );
}
