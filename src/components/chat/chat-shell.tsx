import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DatelloLogo } from "@/components/brand/DatelloLogo";
import { ThreadSidebar } from "./thread-sidebar";

export function ChatShell({
  activeThreadId,
  children,
}: {
  activeThreadId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <ThreadSidebar activeThreadId={activeThreadId} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu des conversations"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          >
            <Menu className="h-4 w-4" />
          </button>
          <DatelloLogo height={26} />
        </div>
        {children}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0">
          <SheetTitle className="sr-only">Conversations</SheetTitle>
          <ThreadSidebar activeThreadId={activeThreadId} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
