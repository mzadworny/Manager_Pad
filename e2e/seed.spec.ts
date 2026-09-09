import { expect, test } from "@playwright/test";

test("guest visiting a protected page is sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/auth\/signin\/?$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
