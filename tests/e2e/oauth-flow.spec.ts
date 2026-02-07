import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";

// Helper function to simulate OAuth connection using test endpoint
async function simulateOAuthConnect(page) {
  const response = await page.request.post(
    "http://localhost:3000/api/admin/test-oauth-connect"
  );
  expect(response.ok()).toBeTruthy();
}

// Helper function to disconnect OAuth
async function disconnectOAuth(page) {
  const response = await page.request.post(
    "http://localhost:3000/api/admin/oauth/disconnect"
  );
  expect(response.ok()).toBeTruthy();
}

test.describe("YouTube OAuth Flow", () => {
  test("should display OAuth status section with disconnected state", async ({
    page
  }) => {
    await loginAsAdmin(page);
    // Ensure disconnected
    await disconnectOAuth(page);
    await page.reload();

    // Check OAuth status section exists
    await expect(
      page.getByRole("heading", { name: "YouTube OAuth Status" })
    ).toBeVisible();

    // Check status badge shows "disconnected"
    await expect(
      page.locator("span.rounded-full:has-text('disconnected')")
    ).toBeVisible();

    // Check Connect button is visible and enabled
    const connectButton = page.getByRole("button", {
      name: /Connect YouTube/i
    });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });

  test("should not display channel ID when disconnected", async ({ page }) => {
    await loginAsAdmin(page);
    // Ensure disconnected
    await disconnectOAuth(page);
    await page.reload();

    // Channel ID should not be visible
    await expect(page.locator("text=Channel ID")).not.toBeVisible();
  });

  test("should show connected status after mock OAuth success", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Simulate OAuth connection
    await simulateOAuthConnect(page);

    // Reload page to see updated status
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Check status badge shows "connected"
    await expect(
      page.locator("span.rounded-full:has-text('connected')")
    ).toBeVisible();

    // Check channel ID is displayed
    await expect(page.locator("text=Channel ID")).toBeVisible();
    await expect(
      page.locator("code:has-text('UC_test_channel_id_12345')")
    ).toBeVisible();

    // Check Disconnect button is visible
    await expect(
      page.getByRole("button", { name: /Disconnect YouTube/i })
    ).toBeVisible();
  });

  test("should disconnect OAuth and return to disconnected state", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // First, connect OAuth using test endpoint
    await simulateOAuthConnect(page);
    await page.reload();

    // Verify connected
    await expect(
      page.locator("span.rounded-full:has-text('connected')")
    ).toBeVisible();

    // Set up dialog handler to accept confirmation
    page.on("dialog", (dialog) => dialog.accept());

    // Click disconnect
    await page.getByRole("button", { name: /Disconnect YouTube/i }).click();

    // Wait for success message to appear
    await expect(page.locator("text=YouTube disconnected.")).toBeVisible();

    // Check status badge returns to "disconnected"
    await expect(
      page.locator("span.rounded-full:has-text('disconnected')")
    ).toBeVisible();

    // Check channel ID is hidden
    await expect(page.locator("text=Channel ID")).not.toBeVisible();

    // Check Connect button is visible again
    await expect(
      page.getByRole("button", { name: /Connect YouTube/i })
    ).toBeVisible();
  });

  test("should show success message after navigation with success param", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Navigate to dashboard with success param
    await page.goto("/admin/dashboard?oauth=success");

    // Wait for page to load and process query param
    await page.waitForLoadState("networkidle");

    // Check success message is displayed
    const successMessage = page.locator(
      ".border-green-900:has-text('YouTube connected successfully!')"
    );
    await expect(successMessage).toBeVisible();
  });

  test("should show error message when OAuth fails", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate with error param
    await page.goto("/admin/dashboard?oauth=error");

    // Wait for page to load and process query param
    await page.waitForLoadState("networkidle");

    // Check error message is displayed
    const errorMessage = page.locator(
      ".border-red-900:has-text('Failed to connect YouTube. Please try again.')"
    );
    await expect(errorMessage).toBeVisible();
  });

  test("should show denied message when user denies OAuth", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Navigate with denied param
    await page.goto("/admin/dashboard?oauth=denied");

    // Wait for page to load and process query param
    await page.waitForLoadState("networkidle");

    // Check denied message is displayed
    const deniedMessage = page.locator(
      ".border-red-900:has-text('YouTube connection was denied.')"
    );
    await expect(deniedMessage).toBeVisible();
  });

  test("should clear OAuth query param from URL after displaying message", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Navigate with success param
    await page.goto("/admin/dashboard?oauth=success");

    // Wait for page to load and process query param
    await page.waitForLoadState("networkidle");

    // Wait a bit for URL to update
    await page.waitForTimeout(500);

    // Check URL has been cleaned (no query param)
    expect(page.url()).toBe("http://localhost:3000/admin/dashboard");
  });
});
