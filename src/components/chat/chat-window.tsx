import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Paperclip } from "lucide-react";
import Papa from "papaparse";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logo from "@/assets/logo.png";

const MAX_PREVIEW_ROWS = 40;

function rowsToUIMessages(rows: { id: string; role: string; parts: unknown }[]): UIMessage[] {
  return rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant",
    parts: (r.parts as UIMessage["parts"]) ?? [],
  }));
}

export function ChatWindow({ threadId }: { threadId: string }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) setAccessToken(session?.access_token ?? null);

      const [{ data: msgs }, { data: thread }] = await Promise.all([
        supabase.from("messages").select("id, role, parts").eq("thread_id", threadId).order("created_at"),
        supabase.from("threads").select("dataset_name").eq("id", threadId).maybeSingle(),
      ]);
      if (cancelled) return;
      setInitialMessages(rowsToUIMessages(msgs ?? []));
      setDatasetName(thread?.dataset_name ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  if (initialMessages === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Shimmer className="text-sm">Chargement de la conversation…</Shimmer>
      </div>
    );
  }

  return (
    <ChatSession
      threadId={threadId}
      initialMessages={initialMessages}
      datasetName={datasetName}
      accessToken={accessToken}
      onDatasetChange={setDatasetName}
    />
  );
}

function ChatSession({
  threadId,
  initialMessages,
  datasetName,
  accessToken,
  onDatasetChange,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  datasetName: string | null;
  accessToken: string | null;
  onDatasetChange: (name: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        headers: () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      }),
    [threadId, accessToken],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    transport,
    messages: initialMessages,
    onError: async (error) => {
      let msg = "Une erreur est survenue. Réessayez.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error) msg = parsed.error;
      } catch {
        if (error.message) msg = error.message;
      }
      toast.error(msg);
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  async function handleCsvUpload(file: File) {
    Papa.parse(file, {
      preview: MAX_PREVIEW_ROWS + 1,
      complete: async (results) => {
        const rows = results.data as string[][];
        const preview = rows.map((r) => r.join(",")).join("\n");
        const { error } = await supabase
          .from("threads")
          .update({ dataset_name: file.name, dataset_preview: preview })
          .eq("id", threadId);
        if (error) {
          toast.error("Impossible d'associer le fichier à la conversation.");
          return;
        }
        onDatasetChange(file.name);
        toast.success(`Fichier « ${file.name} » chargé. Posez votre question !`);
        textareaRef.current?.focus();
      },
      error: () => toast.error("Lecture du fichier impossible. Utilisez un CSV valide."),
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {datasetName ? (
            <>
              <Paperclip className="h-4 w-4" />
              <span className="font-medium text-foreground">{datasetName}</span>
            </>
          ) : (
            <span>Aucun fichier associé — téléversez un CSV pour analyser vos données.</span>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {datasetName ? "Remplacer le fichier" : "Téléverser un CSV"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsvUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <img src={logo} alt="DA-Copilot" width={56} height={56} className="h-14 w-14" />
              <h2 className="mt-4 font-display text-xl font-semibold">Que voulez-vous analyser ?</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Téléversez un fichier CSV, puis posez votre question métier : « Quels sont mes meilleurs
                produits ? », « Y a-t-il des anomalies dans mes ventes ? »…
              </p>
            </div>
          )}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && <Shimmer className="text-sm">Analyse en cours…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background px-4 py-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(message) => {
              if (!message.text.trim() || busy) return;
              sendMessage({ text: message.text });
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Posez votre question sur vos données…"
              disabled={busy}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            DA-Copilot base ses réponses sur l'extrait de données fourni. Vérifiez les chiffres clés.
          </p>
        </div>
      </div>
    </div>
  );
}
