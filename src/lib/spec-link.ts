import type { ReportSpec } from "./types";

/**
 * Report specs travel through the URL when a suggestion or a data set opens the
 * builder. Base64url keeps them safe to paste and share.
 */
export function encodeSpec(spec: Partial<ReportSpec>): string {
  const json = JSON.stringify(spec);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSpec(encoded: string): Partial<ReportSpec> | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
