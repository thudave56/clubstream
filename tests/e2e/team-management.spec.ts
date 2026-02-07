import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";

test.describe("Team Management", () => {
  test("admin can add, rename, and disable a team (affects public dropdown)", async ({
    page
  }) => {
    await loginAsAdmin(page);

    await expect(page.getByRole("heading", { name: "Teams" })).toBeVisible();

    const suffix = Date.now();
    const originalName = `Test Team ${suffix}`;
    const renamed = `Test Team Renamed ${suffix}`;

    await page.getByLabel("New team name").fill(originalName);
    await page.getByRole("button", { name: "Add team" }).click();

    const rowByName = page.locator(`[data-team-id]`, { hasText: originalName });
    await expect(rowByName).toBeVisible({ timeout: 15000 });
    const teamId = await rowByName.getAttribute("data-team-id");
    expect(teamId).toBeTruthy();

    // Confirm it shows up in the public match creation dropdown
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("select#teamId")).toContainText(originalName);

    // Rename from admin
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    const adminRow = page.locator(`[data-team-id="${teamId}"]`);
    await adminRow.getByRole("button", { name: "Edit" }).click();
    await adminRow
      .getByLabel(`Edit team name for ${originalName}`)
      .fill(renamed);
    await adminRow.getByRole("button", { name: "Save" }).click();
    await expect(adminRow.getByText(renamed, { exact: true })).toBeVisible({
      timeout: 15000
    });

    // Disable it
    page.once("dialog", (d) => d.accept());
    const renamedRow = page.locator(`[data-team-id="${teamId}"]`);
    await renamedRow.getByRole("button", { name: "Disable" }).click();
    await expect(renamedRow.getByText("Disabled")).toBeVisible();

    // Confirm it is removed from the public dropdown
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("select#teamId")).not.toContainText(renamed);
  });
});
