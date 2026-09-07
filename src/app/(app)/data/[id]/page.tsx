import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CatalogExplorer } from "@/components/data/catalog-explorer";
import { PageBody } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { withoutConnectionLink } from "@/lib/redact";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/data/[id]">) {
  const { id } = await params;
  const source = await store.getSource(id);
  return { title: source?.name ?? "Data source" };
}

export default async function DataSourcePage({ params }: PageProps<"/data/[id]">) {
  const { id } = await params;
  const source = await store.getSource(id);
  if (!source) notFound();

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
          All connections
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{source.name}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This is Mosaic&apos;s reading of your database. Anything you change here — names, what a
          field means, what stays hidden — is what everyone sees when they build a report.
        </p>
      </div>

      <CatalogExplorer source={safe} catalog={catalog ?? null} />
    </PageBody>
  );
}
