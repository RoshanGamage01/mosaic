import "server-only";

import { MongoClient, type Db } from "mongodb";

/**
 * The agent may watch several databases at once, so clients are pooled per
 * connection string and reused across requests (and across dev hot reloads).
 */
const globalPool = globalThis as unknown as {
  __mosaicClients?: Map<string, Promise<MongoClient>>;
};
const pool = (globalPool.__mosaicClients ??= new Map());

export function getClient(uri: string): Promise<MongoClient> {
  const existing = pool.get(uri);
  if (existing) return existing;

  const created = MongoClient.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    maxPoolSize: 10,
    // The agent is a read-only observer of customer data.
    readPreference: "secondaryPreferred",
    retryWrites: false,
  }).catch((error) => {
    pool.delete(uri);
    throw error;
  });

  pool.set(uri, created);
  return created;
}

export async function getDb(uri: string, database: string): Promise<Db> {
  const client = await getClient(uri);
  return client.db(database);
}

export async function closeClient(uri: string) {
  const existing = pool.get(uri);
  if (!existing) return;
  pool.delete(uri);
  try {
    (await existing).close().catch(() => undefined);
  } catch {
    /* already failed to connect */
  }
}

export class ConnectionError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
    this.name = "ConnectionError";
  }
}

/** Turns driver errors into something a non-technical operator can act on. */
export function explainConnectionError(error: unknown): ConnectionError {
  const message = error instanceof Error ? error.message : String(error);
  if (/Authentication failed|bad auth/i.test(message)) {
    return new ConnectionError(
      "The username or password was not accepted.",
      "Check the credentials in your connection link, then try again.",
    );
  }
  if (/ENOTFOUND|getaddrinfo|querySrv/i.test(message)) {
    return new ConnectionError(
      "We could not find a server at that address.",
      "Double-check the host name in the connection link.",
    );
  }
  if (/ECONNREFUSED|Server selection timed out|connect ETIMEDOUT/i.test(message)) {
    return new ConnectionError(
      "The database did not answer in time.",
      "Make sure the server is running and that this machine is allowed to reach it.",
    );
  }
  if (/Invalid scheme|Invalid connection string/i.test(message)) {
    return new ConnectionError(
      "That does not look like a MongoDB connection link.",
      "It should start with mongodb:// or mongodb+srv://",
    );
  }
  if (/not authorized|Unauthorized/i.test(message)) {
    return new ConnectionError(
      "This account is not allowed to read that database.",
      "Grant the user read access to the database and try again.",
    );
  }
  return new ConnectionError(message);
}
