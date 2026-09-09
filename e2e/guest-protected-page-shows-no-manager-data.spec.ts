// risk: test-plan.md #2 — A guest / unauthenticated request can read any manager's data (page or API)
// seed: e2e/seed.spec.ts

import { expect, test } from "@playwright/test";

test.describe("guest isolation", () => {
  test("guest visiting a protected page is sent to sign-in and sees no manager data", async ({ page }) => {
    // Open a gated app page with an empty session (no storageState).
    await page.goto("/dashboard");

    // Middleware must send the browser to sign-in, not render the dashboard shell.
    await expect(page).toHaveURL(/\/auth\/signin\/?$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();

    // Authenticated manager UI must not leak into the guest document.
    await expect(page.getByRole("heading", { name: "Team Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Create team" })).toHaveCount(0);
    await expect(page.getByText("Signed in as")).toHaveCount(0);
  });
});
