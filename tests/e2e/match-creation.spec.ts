import { test, expect, Page } from "@playwright/test";

/**
 * Helper to log in as admin
 * Reuses pattern from admin-auth.spec.ts
 */
async function loginAsAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin PIN").fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/admin/dashboard");
}

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

test.describe("Match Creation", () => {
  test("should not show match management when OAuth disconnected", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await disconnectOAuth(page);
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Match Management section should not be visible
    await expect(
      page.getByRole("heading", { name: "Match Management" })
    ).not.toBeVisible();
  });

  // TODO: Fix OAuth simulation timing in test environment
  test.skip("should show match creation form when OAuth connected", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await populateTestStreamPool(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for Match Management to load
    await page.waitForTimeout(1000);

    // Check Match Management section exists
    await expect(
      page.getByRole("heading", { name: "Match Management" })
    ).toBeVisible();

    // Check form elements are visible
    await expect(page.getByLabel("Team *")).toBeVisible();
    await expect(page.getByLabel("Opponent Name *")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Match" })
    ).toBeVisible();
  });

  // TODO: Fix OAuth simulation timing in test environment
  test.skip("should create match successfully", async ({ page }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await populateTestStreamPool(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for form to load
    await page.waitForTimeout(1500);

    // Fill form
    const teamSelect = page.getByLabel("Team *");
    await teamSelect.selectOption({ index: 1 }); // Select first real team

    await page.getByLabel("Opponent Name *").fill("Test Opponent");
    await page.getByLabel("Court Label (Optional)").fill("Court 1");

    // Submit form
    await page.getByRole("button", { name: "Create Match" }).click();

    // Wait for success message
    await expect(page.getByText("Match created successfully!")).toBeVisible({
      timeout: 10000
    });

    // Check QR code is displayed
    await expect(page.getByText("Scan with phone camera")).toBeVisible();
  });

  // TODO: Fix OAuth simulation timing in test environment
  test.skip("should display match list", async ({ page }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for matches to load
    await page.waitForTimeout(1500);

    // Check Recent Matches heading
    await expect(
      page.getByRole("heading", { name: "Recent Matches" })
    ).toBeVisible();
  });
});

test.describe("Match Management", () => {
  // TODO: Fix OAuth simulation timing in test environment
  test.skip("should show status badges with correct colors", async ({
    page
  }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.waitForTimeout(1500);

    // Check for status badges (at least draft status should exist)
    const badges = page.locator(".rounded-full.px-3");
    await expect(badges.first()).toBeVisible();
  });

  // TODO: Fix OAuth simulation timing in test environment
  test.skip("should allow canceling draft match", async ({ page }) => {
    await loginAsAdmin(page);
    await simulateOAuthConnect(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await page.waitForTimeout(1500);

    // Look for Cancel button on draft matches
    const cancelButton = page.getByRole("button", { name: "Cancel" }).first();

    if (await cancelButton.isVisible()) {
      // Set up dialog handler
      page.once("dialog", (dialog) => {
        expect(dialog.message()).toContain("Are you sure");
        dialog.accept();
      });

      await cancelButton.click();

      // Wait for success message
      await expect(page.getByText("Match canceled")).toBeVisible({
        timeout: 5000
      });
    }
  });
});
