import { AppShell } from "@/components/app-shell";
import { ensureBootstrap } from "@/lib/bootstrap";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Registers and scans the sample database on a brand new install.
  await ensureBootstrap();
  const sources = await store.listSources();
  return <AppShell connected={sources.length > 0}>{children}</AppShell>;
}
