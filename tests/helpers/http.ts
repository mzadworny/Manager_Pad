import { testBaseUrl, type AuthedFetch } from "./session";

export const WELL_FORMED_UUID = "00000000-0000-4000-8000-000000000001";

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  return JSON.parse(text) as unknown;
}

export async function guestFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const baseUrl = testBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("Origin", new URL(baseUrl).origin);
  headers.delete("Cookie");
  return fetch(new URL(path, baseUrl), { ...init, headers, redirect: init.redirect ?? "manual" });
}

export function locationPath(response: Response, baseUrl: string): string | undefined {
  const location = response.headers.get("location");
  if (!location) {
    return undefined;
  }
  return new URL(location, baseUrl).pathname;
}

export function recordOf(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  return body as Record<string, unknown>;
}

export function entityId(body: unknown, key: string): string {
  const entity = recordOf(recordOf(body)?.[key]);
  if (typeof entity?.id !== "string") {
    throw new Error(`Expected ${key}.id to be a string`);
  }
  return entity.id;
}

export function idsFrom(body: unknown, collection: string): string[] {
  const list = recordOf(body)?.[collection];
  const items: unknown[] = Array.isArray(list) ? list : [];
  const ids: string[] = [];
  for (const item of items) {
    const id = recordOf(item)?.id;
    if (typeof id === "string") {
      ids.push(id);
    }
  }
  return ids;
}

export function populatedProductKeys(body: unknown): string[] {
  const rec = recordOf(body);
  if (!rec) {
    return [];
  }
  const found: string[] = [];
  for (const key of ["teams", "employees", "meetings", "tasks"] as const) {
    if (Array.isArray(rec[key]) && rec[key].length > 0) {
      found.push(key);
    }
  }
  if (rec.notesJson != null) {
    found.push("notesJson");
  }
  if (typeof rec.notes === "string" && rec.notes.length > 0) {
    found.push("notes");
  }
  for (const key of ["employee", "meeting", "task", "team"] as const) {
    if (rec[key] != null && typeof rec[key] === "object") {
      found.push(key);
    }
  }
  return found;
}

export async function jsonAs(
  client: AuthedFetch,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await client(path, init);
  return { status: response.status, body: await readJson(response) };
}
