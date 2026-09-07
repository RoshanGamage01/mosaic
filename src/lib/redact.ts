import type { DataSource } from "./types";

export type SafeDataSource = Omit<DataSource, "uri"> & { host?: string };

/** Connection links stay on the server; everything else about a source is public. */
export function withoutConnectionLink(source: DataSource): SafeDataSource {
  const copy: Partial<DataSource> = { ...source };
  delete copy.uri;
  return copy as SafeDataSource;
}

/** The host portion of a connection link, safe to show in the UI. */
export function hostOf(uri: string): string {
  try {
    const asUrl = uri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://");
    return new URL(asUrl).host;
  } catch {
    return "unknown host";
  }
}
