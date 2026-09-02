import { applyDotEnv, nonEmpty } from "./env";

export type AuthedFetch = (path: string, init?: RequestInit) => Promise<Response>;

export function cookieHeaderFromSetCookie(setCookies: readonly string[]): string {
  return setCookies
    .map((entry) => entry.split(";")[0]?.trim() ?? "")
    .filter((pair) => {
      const eq = pair.indexOf("=");
      if (eq <= 0) {
        return false;
      }
      return pair.slice(eq + 1) !== "";
    })
    .join("; ");
}

export function testBaseUrl(): string {
  applyDotEnv();
  return nonEmpty(process.env.TEST_BASE_URL) ?? "http://localhost:4321";
}

export async function signIn(email: string, password: string): Promise<AuthedFetch> {
  const baseUrl = testBaseUrl();
  const origin = new URL(baseUrl).origin;
  const response = await fetch(new URL("/api/auth/signin", baseUrl), {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: origin,
    },
    body: new URLSearchParams({ email, password }),
  });

  const location = response.headers.get("location") ?? "";
  const locationPath = location ? new URL(location, baseUrl).pathname : "";
  if (location.includes("error=") || locationPath !== "/dashboard") {
    const hint = (await response.text()).trim().slice(0, 200);
    throw new Error(
      `Sign-in failed for ${email} (status ${String(response.status)}, Location ${nonEmpty(location) ?? "(none)"}). ${hint} See context/foundation/test-accounts.md.`,
    );
  }

  const cookie = cookieHeaderFromSetCookie(response.headers.getSetCookie());
  if (!cookie) {
    throw new Error(`Sign-in for ${email} returned no Set-Cookie. See context/foundation/test-accounts.md.`);
  }

  return async (path, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Cookie", cookie);
    headers.set("Origin", origin);
    return fetch(new URL(path, baseUrl), { ...init, headers });
  };
}
