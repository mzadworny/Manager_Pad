import { loadEnv } from "vite";

const REQUIRED_KEYS = [
  "TEST_MANAGER_A_EMAIL",
  "TEST_MANAGER_A_PASSWORD",
  "TEST_MANAGER_B_EMAIL",
  "TEST_MANAGER_B_PASSWORD",
] as const;

export interface IsolationEnv {
  baseUrl: string;
  managerA: { email: string; password: string };
  managerB: { email: string; password: string };
}

export function applyDotEnv(): void {
  const loaded = loadEnv("test", process.cwd(), "");
  for (const [key, value] of Object.entries(loaded)) {
    process.env[key] ??= value;
  }
}

export function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

export function readIsolationEnv(env: NodeJS.Dict<string> = process.env): IsolationEnv {
  if (env === process.env) {
    applyDotEnv();
  }

  const missing = REQUIRED_KEYS.filter((key) => !nonEmpty(env[key]));
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")}. Set them in .env (see .env.example) and context/foundation/test-accounts.md.`,
    );
  }

  return {
    baseUrl: nonEmpty(env.TEST_BASE_URL) ?? "http://localhost:4321",
    managerA: {
      email: nonEmpty(env.TEST_MANAGER_A_EMAIL) ?? "",
      password: env.TEST_MANAGER_A_PASSWORD ?? "",
    },
    managerB: {
      email: nonEmpty(env.TEST_MANAGER_B_EMAIL) ?? "",
      password: env.TEST_MANAGER_B_PASSWORD ?? "",
    },
  };
}
