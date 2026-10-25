import type { ReactNode } from "react";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, LogOut, Plus, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xl font-extrabold text-foreground">WebListo</span>
      <Check aria-hidden="true" className="h-4 w-4 text-primary" strokeWidth={3} />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useRouteContext({ from: "/_authenticated" });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 sm:flex sm:justify-between sm:px-6">
          <Logo />
          <div className="contents sm:flex sm:items-center sm:gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="order-3 col-span-2 w-full sm:order-none sm:w-auto">
                  <Plus /> Importar / Sincronizar Leads
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="min-h-48 max-w-[calc(100%-2rem)] rounded-xl border-border bg-card shadow-none sm:max-w-lg">
                <DialogHeader><DialogTitle className="pr-6 leading-snug">Importar / Sincronizar Leads</DialogTitle></DialogHeader>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="Menu do usuário" title="Menu do usuário" className="justify-self-end">
                  <UserRound /> <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-[calc(100vw-2rem)]">
                <DropdownMenuLabel className="break-all text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}><LogOut /> Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
