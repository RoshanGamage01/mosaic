import { AppShell } from "@/components/app-shell";
import { ensureBootstrap } from "@/lib/bootstrap";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Registers and scans the sample database on a brand new install.
  await ensureBootstrap();
  return <AppShell>{children}</AppShell>;
}
