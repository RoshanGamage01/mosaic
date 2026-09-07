import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";

import { CreateDashboard } from "@/components/dashboard/create-dashboard";
import { EmptyState } from "@/components/empty-state";
import { PageBody, PageHeader } from "@/components/page-header";
import { formatRelative } from "@/lib/format";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboards" };

export default async function DashboardsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const dashboards = await store.listDashboards(tenant.id);

  return (
    <PageBody className="space-y-6">
      <PageHeader
        eyebrow="Boards"
        title="Morning boards"
        description="Open a board to see this morning's numbers. Click any tile to ask a follow-up."
        actions={<CreateDashboard />}
      />

      {dashboards.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No boards yet"
          description="Connect a database and Mosaic will open the boards this operation can actually answer."
          action={<CreateDashboard />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((dashboard) => (
              <Link
                key={dashboard.id}
                href={`/dashboards/${dashboard.id}`}
                className="surface surface-hover group flex flex-col gap-3 p-5"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-xl">
                  {dashboard.emoji ?? "📊"}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-semibold">{dashboard.name}</p>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {dashboard.description || "No description yet."}
                  </p>
                </div>
                <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  {dashboard.tiles.length} {dashboard.tiles.length === 1 ? "tile" : "tiles"}
                  <span className="text-border">•</span>
                  updated {formatRelative(dashboard.updatedAt)}
                  <ArrowRight className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
              </Link>
            ))}
        </div>
      )}
    </PageBody>
  );
}
