"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Database,
  LayoutGrid,
  Menu,
  PieChart,
  Plus,
  Sparkles,
} from "lucide-react";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api } from "@/lib/client";
import type { Tenant } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Sparkles, exact: true },
  { href: "/dashboards", label: "Boards", icon: LayoutGrid },
  { href: "/reports", label: "Reports", icon: PieChart },
  { href: "/data", label: "Database", icon: Database },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon
              className={cn("size-[18px] transition-colors", active ? "text-primary" : "text-muted-foreground/80")}
              strokeWidth={2}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  tenant,
  tenants,
  onNavigate,
}: {
  tenant?: Tenant;
  tenants: Tenant[];
  onNavigate?: () => void;
}) {
  const router = useRouter();

  async function switchTenant(id: string) {
    await api(`/api/tenants/${id}/select`, { method: "POST" });
    onNavigate?.();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" onClick={onNavigate} className="px-2 pt-2">
        <Wordmark subtitle={tenant?.name ?? "for your operation"} />
      </Link>

      {tenant ? (
        <Button
          render={<Link href="/reports/new" onClick={onNavigate} />}
          className="justify-start gap-2 rounded-xl"
          size="lg"
        >
          <Plus className="size-4" />
          New report
        </Button>
      ) : null}

      {tenant ? <NavLinks onNavigate={onNavigate} /> : null}

      <div className="mt-auto space-y-3">
        {tenants.length > 1 ? (
          <div className="rounded-xl border border-border bg-muted/40 p-2">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Companies
            </p>
            {tenants.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void switchTenant(item.id)}
                className={cn(
                  "flex w-full rounded-lg px-2 py-1.5 text-left text-sm",
                  item.id === tenant?.id ? "bg-card font-medium" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        ) : null}
        <Button
          render={<Link href="/register" onClick={onNavigate} />}
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-lg text-muted-foreground"
        >
          Register another company
        </Button>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  tenant,
  tenants,
}: {
  children: React.ReactNode;
  tenant?: Tenant;
  tenants: Tenant[];
}) {
  const [open, setOpen] = useState(false);
  const setup = !tenant;

  if (setup) {
    return <div className="app-canvas min-h-dvh">{children}</div>;
  }

  return (
    <div className="app-canvas flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border bg-sidebar/70 backdrop-blur-xl lg:block">
        <SidebarBody tenant={tenant} tenants={tenants} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody tenant={tenant} tenants={tenants} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Wordmark subtitle={tenant.name} />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
