import { describe, expect, it } from "vitest";
import { readIsolationEnv } from "../helpers/env";

describe("readIsolationEnv", () => {
  it("fails with an actionable message when TEST_MANAGER_B_* are missing", () => {
    expect(() =>
      readIsolationEnv({
        TEST_MANAGER_A_EMAIL: "a@example.com",
        TEST_MANAGER_A_PASSWORD: "secret",
      }),
    ).toThrow(/TEST_MANAGER_B_EMAIL, TEST_MANAGER_B_PASSWORD[\s\S]*\.env\.example[\s\S]*test-accounts\.md/);
  });
});
