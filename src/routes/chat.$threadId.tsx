import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ThreadSidebar } from "@/components/chat/thread-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Analyse en cours — DA-Copilot" },
      { name: "description", content: "Conversation d'analyse de données avec DA-Copilot." },
    ],
  }),
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

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
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, threadId]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Shimmer className="text-sm">Vérification de votre session…</Shimmer>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <ThreadSidebar activeThreadId={threadId} />
      <ChatWindow key={threadId} threadId={threadId} />
    </div>
  );
}
