import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DatelloLogo } from "@/components/brand/DatelloLogo";
import { useLang } from "@/lib/i18n";
import { ThreadSidebar } from "./thread-sidebar";

export function ChatShell({
  activeThreadId,
  children,
}: {
  activeThreadId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLang();

  return (
    <div className="flex h-dvh bg-background">
      <ThreadSidebar activeThreadId={activeThreadId} className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("Ouvrir le menu")}
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
          <SheetTitle className="sr-only">{t("Conversations")}</SheetTitle>
          <ThreadSidebar activeThreadId={activeThreadId} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
