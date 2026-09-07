import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CatalogExplorer } from "@/components/data/catalog-explorer";
import { PageBody } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { withoutConnectionLink } from "@/lib/redact";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/data/[id]">) {
  const { id } = await params;
  const source = await store.getSource(id);
  return { title: source?.name ?? "Database" };
}

export default async function DataSourcePage({ params }: PageProps<"/data/[id]">) {
  const { id } = await params;
  const [source, tenant] = await Promise.all([store.getSource(id), getCurrentTenant()]);
  if (!source || !tenant || source.tenantId !== tenant.id) notFound();

  const catalog = await store.getCatalog(id);
  const safe = withoutConnectionLink(source);

  return (
    <PageBody className="space-y-5">
      <div className="space-y-1.5">
        <Button
          render={<Link href="/data" />}
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 rounded-lg text-muted-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All databases
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{source.name}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mosaic reads the <span className="font-medium text-foreground">{source.database}</span>{" "}
          database. Rename a field here and every report for this company uses the new name.
        </p>
      </div>

      <CatalogExplorer source={safe} catalog={catalog ?? null} />
    </PageBody>
  );
}
