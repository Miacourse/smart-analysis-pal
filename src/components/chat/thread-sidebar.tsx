import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, Trash2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

type Thread = {
  id: string;
  title: string;
  dataset_name: string | null;
  updated_at: string;
};

export function ThreadSidebar({ activeThreadId }: { activeThreadId?: string }) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);

  async function loadThreads() {
    const { data, error } = await supabase
      .from("threads")
      .select("id, title, dataset_name, updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setThreads(data ?? []);
  }

  useEffect(() => {
    loadThreads();
  }, [activeThreadId]);

  async function createThread() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Impossible de créer la conversation.");
      return;
    }
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function deleteThread(id: string) {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible.");
      return;
    }
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (id === activeThreadId) navigate({ to: "/chat" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
        <img src={logo} alt="DA-Copilot" width={28} height={28} className="h-7 w-7" />
        <span className="font-display font-semibold text-sidebar-foreground">DA-Copilot</span>
      </div>

      <div className="p-3">
        <button
          onClick={createThread}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nouvelle analyse
        </button>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {threads.map((t) => (
          <div
            key={t.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
              t.id === activeThreadId
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <Link
              to="/chat/$threadId"
              params={{ threadId: t.id }}
              className="min-w-0 flex-1 truncate px-1 py-1"
            >
              <span className="block truncate font-medium">{t.title}</span>
              {t.dataset_name && (
                <span className="block truncate text-xs text-muted-foreground">{t.dataset_name}</span>
              )}
            </Link>
            <button
              onClick={() => deleteThread(t.id)}
              aria-label="Supprimer la conversation"
              className="rounded p-1 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}
        {threads.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Aucune conversation. Lancez votre première analyse !
          </p>
        )}
      </div>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
