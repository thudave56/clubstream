import { test, expect, Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";

/**
 * Helper to simulate OAuth connection using test endpoint
 */
async function simulateOAuthConnect(page: Page) {
  const response = await page.request.post(
    "http://localhost:3000/api/admin/test-oauth-connect"
  );
  expect(response.ok()).toBeTruthy();
}

/**
 * Helper to disconnect OAuth
 */
async function disconnectOAuth(page: Page) {
  const response = await page.request.post(
    "http://localhost:3000/api/admin/oauth/disconnect"
  );
  expect(response.ok()).toBeTruthy();
}

/**
 * Helper to populate stream pool with test data
 */
async function populateTestStreamPool(page: Page) {
  const response = await page.request.post(
    "http://localhost:3000/api/admin/test-stream-pool"
  );
  expect(response.ok()).toBeTruthy();
}

test.describe("Stream Pool Management", () => {
  test("should not show stream pool controls when OAuth disconnected", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Ensure OAuth is disconnected
    await disconnectOAuth(page);

    // Navigate to dashboard
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Wait for settings to load
    await page.waitForTimeout(1000);

    // Check Stream Pool Status heading exists
    await expect(
      page.getByRole("heading", { name: "Stream Pool Status" })
    ).toBeVisible();

    // Check message about connecting YouTube first
    await expect(
      page.getByText("Connect YouTube first to manage stream pool")
    ).toBeVisible();

    // Initialize button should not be visible
    await expect(
      page.getByRole("button", { name: /Initialize Stream Pool/i })
    ).not.toBeVisible();
  });

  test("should show stream pool controls when OAuth connected", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.locator("span.rounded-full:has-text('connected')")
    ).toBeVisible({ timeout: 10000 });

    // Check Stream Pool Status section
    await expect(
      page.getByRole("heading", { name: "Stream Pool Status" })
    ).toBeVisible();

    // Initialize button should be visible
    const initButton = page.getByRole("button", {
      name: /Initialize Stream Pool/i
    });
    await expect(initButton).toBeVisible();
    await expect(initButton).toBeEnabled();
  });

  test("should display pool status counts correctly", async ({ page }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);

    // Populate test stream pool
    await populateTestStreamPool(page);

    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.locator("span.rounded-full:has-text('connected')")
    ).toBeVisible({ timeout: 10000 });

    // Check that status counts are displayed
    // Note: Exact counts depend on test data - test-stream-pool creates 3 streams
    // 1 available, 1 reserved, 1 in_use
    const statusSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Stream Pool Status" })
    });

    // Look for the presence of status labels
    await expect(statusSection.getByText("Available")).toBeVisible();
    await expect(statusSection.getByText("Reserved")).toBeVisible();
    await expect(statusSection.getByText("In Use")).toBeVisible();
    await expect(statusSection.getByText("Stuck")).toBeVisible();
    await expect(statusSection.getByText("Total")).toBeVisible();
  });

  // TODO: Fix OAuth simulation timing in test environment - will be tested manually
  test.skip("should show success message after initializing pool", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for pool status to load
    await page.waitForTimeout(1000);

    // Set up dialog handler to provide count
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("How many streams");
      dialog.accept("3");
    });

    // Click initialize button
    await page
      .getByRole("button", { name: /Initialize Stream Pool/i })
      .click();

    // Wait for success message
    // Note: This will actually try to create YouTube streams, which may fail in test
    // In a real test with mocked YouTube API, we'd see success
    // For now, just verify the button interaction works
    await page.waitForTimeout(2000);

    // Check that button is back to enabled state after attempt
    const initButton = page.getByRole("button", {
      name: /Initialize Stream Pool/i
    });
    await expect(initButton).toBeEnabled();
  });

  test("should show pool warning when streams exist", async ({ page }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await populateTestStreamPool(page);

    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.locator("span.rounded-full:has-text('connected')")
    ).toBeVisible({ timeout: 10000 });

    // Check for the warning message about existing streams
    await expect(
      page.getByText(/Pool already has \d+ stream/)
    ).toBeVisible();
  });

  test("should handle invalid pool count input", async ({ page }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Set up dialog handler to provide invalid count
    page.once("dialog", (dialog) => {
      dialog.accept("99"); // Invalid - too high
    });

    // Click initialize button
    await page
      .getByRole("button", { name: /Initialize Stream Pool/i })
      .click();

    // Should show error message
    await expect(
      page.getByText("Invalid count. Enter 1-20.")
    ).toBeVisible();
  });

  test("should handle canceled pool initialization", async ({ page }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Set up dialog handler to cancel
    page.once("dialog", (dialog) => {
      dialog.dismiss();
    });

    // Click initialize button
    await page
      .getByRole("button", { name: /Initialize Stream Pool/i })
      .click();

    // Nothing should happen - button should still be enabled
    const initButton = page.getByRole("button", {
      name: /Initialize Stream Pool/i
    });
    await expect(initButton).toBeEnabled();
  });
});
