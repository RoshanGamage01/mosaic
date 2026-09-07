/**
 * Runs once when the server boots, before any request is handled, so a fresh
 * install has already registered and scanned its sample database by the time
 * someone opens the app.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureBootstrap } = await import("./lib/bootstrap");
  await ensureBootstrap();
}
