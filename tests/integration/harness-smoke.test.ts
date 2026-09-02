import { beforeAll, describe, expect, it } from "vitest";
import { readIsolationEnv } from "../helpers/env";
import { signIn, type AuthedFetch } from "../helpers/session";

function hasTeamsArray(value: unknown): value is { teams: unknown[] } {
  return typeof value === "object" && value !== null && "teams" in value && Array.isArray(value.teams);
}

describe("two-session harness", () => {
  let asA: AuthedFetch;
  let asB: AuthedFetch;

  beforeAll(async () => {
    const env = readIsolationEnv();
    asA = await signIn(env.managerA.email, env.managerA.password);
    asB = await signIn(env.managerB.email, env.managerB.password);
  });

  it("Manager A GET /api/teams is 200 with a teams array", async () => {
    const response = await asA("/api/teams");
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(hasTeamsArray(body)).toBe(true);
  });

  it("Manager B GET /api/teams is 200 with a teams array", async () => {
    const response = await asB("/api/teams");
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(hasTeamsArray(body)).toBe(true);
  });
});
