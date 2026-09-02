import { spawn, type ChildProcess } from "node:child_process";
import { applyDotEnv } from "./helpers/env";
import { testBaseUrl } from "./helpers/session";

const READY_TIMEOUT_MS = 120_000;
const POLL_MS = 500;

function isUnitOnlyRun(): boolean {
  const pathArgs = process.argv.filter((arg) => arg.includes("tests"));
  return pathArgs.length > 0 && pathArgs.every((arg) => arg.includes("tests/unit"));
}

async function isListening(url: string): Promise<boolean> {
  try {
    await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function waitUntilListening(url: string, child: ChildProcess, output: () => string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  await new Promise<void>((resolve, reject) => {
    const onExit = (code: number | null) => {
      reject(new Error(`npm run dev exited with ${String(code)} before ${url} responded.\n${output()}`));
    };
    child.once("exit", onExit);

    const poll = (): void => {
      void isListening(url).then((up) => {
        if (up) {
          child.off("exit", onExit);
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          child.off("exit", onExit);
          reject(new Error(`Timed out after ${READY_TIMEOUT_MS}ms waiting for ${url}.\n${output()}`));
          return;
        }
        setTimeout(poll, POLL_MS);
      });
    };

    poll();
  });
}

function stopSpawned(child: ChildProcess): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

export default async function globalSetup(): Promise<(() => void) | undefined> {
  applyDotEnv();
  if (isUnitOnlyRun()) {
    return undefined;
  }

  const baseUrl = testBaseUrl();
  if (await isListening(baseUrl)) {
    return undefined;
  }

  let output = "";
  const child = spawn("npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  const append = (chunk: Buffer | string): void => {
    output += String(chunk);
    if (output.length > 16_000) {
      output = output.slice(-12_000);
    }
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  try {
    await waitUntilListening(baseUrl, child, () => output);
  } catch (error) {
    stopSpawned(child);
    throw error;
  }

  return () => {
    stopSpawned(child);
  };
}
