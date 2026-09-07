"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Sparkles, exact: true },
  { href: "/dashboards", label: "Dashboards", icon: LayoutGrid },
  { href: "/reports", label: "Reports", icon: PieChart },
  { href: "/data", label: "Your data", icon: Database },
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

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" onClick={onNavigate} className="px-2 pt-2">
        <Wordmark />
      </Link>

      <Button
        render={<Link href="/reports/new" onClick={onNavigate} />}
        className="justify-start gap-2 rounded-xl"
        size="lg"
      >
        <Plus className="size-4" />
        Build a report
      </Button>

      <NavLinks onNavigate={onNavigate} />

      <div className="mt-auto rounded-xl border border-dashed border-border bg-muted/40 p-3.5">
        <p className="text-[13px] font-medium">Nothing to configure</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Mosaic reads your database directly. Connect one and it works out what is inside.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-canvas flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-sidebar-border bg-sidebar/70 backdrop-blur-xl lg:block">
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Wordmark />
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
