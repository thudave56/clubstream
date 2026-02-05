import { test, expect } from "@playwright/test";

// Helper function to log in as admin
async function loginAsAdmin(page) {
  await page.goto("/admin");
  await page.getByLabel("Admin PIN").fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/admin/dashboard");
}

// Helper function to simulate OAuth connection using test endpoint
async function simulateOAuthConnect(page) {
  const response = await page.request.post(
    "http://localhost:3000/api/admin/test-oauth-connect"
  );
  expect(response.ok()).toBeTruthy();
}

test.describe("YouTube OAuth Flow", () => {
  test("should display OAuth status section with disconnected state", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Check OAuth status section exists
    await expect(
      page.getByRole("heading", { name: "YouTube OAuth Status" })
    ).toBeVisible();

    // Check status badge shows "disconnected"
    await expect(page.locator("text=disconnected")).toBeVisible();

    // Check Connect button is visible and enabled
    const connectButton = page.getByRole("button", {
      name: /Connect YouTube/i
    });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });

  test("should not display channel ID when disconnected", async ({ page }) => {
    await loginAsAdmin(page);

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

    // Check status badge shows "connected"
    await expect(page.locator("text=connected")).toBeVisible();

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
    await expect(page.locator("text=connected")).toBeVisible();

    // Set up dialog handler to accept confirmation
    page.on("dialog", (dialog) => dialog.accept());

    // Click disconnect
    await page.getByRole("button", { name: /Disconnect YouTube/i }).click();

    // Wait for disconnection to complete
    await page.waitForTimeout(1000);

    // Check status returns to "disconnected"
    await expect(page.locator("text=disconnected")).toBeVisible();

    // Check channel ID is hidden
    await expect(page.locator("text=Channel ID")).not.toBeVisible();

    // Check Connect button is visible again
    await expect(
      page.getByRole("button", { name: /Connect YouTube/i })
    ).toBeVisible();
  });

  test("should show success message after connection", async ({ page }) => {
    await loginAsAdmin(page);

    // Simulate OAuth connection
    await simulateOAuthConnect(page);

    // Navigate to dashboard with success param
    await page.goto("/admin/dashboard?oauth=success");

    // Check success message is displayed
    await expect(
      page.locator("text=YouTube connected successfully!")
    ).toBeVisible();

    // Message should have green styling
    const messageBox = page.locator(
      "text=YouTube connected successfully!"
    ).locator("..");
    await expect(messageBox).toHaveClass(/bg-green-900/);
  });

  test("should show error message when OAuth fails", async ({ page }) => {
    await loginAsAdmin(page);

    // Navigate with error param
    await page.goto("/admin/dashboard?oauth=error");

    // Check error message is displayed
    await expect(
      page.locator("text=Failed to connect YouTube. Please try again.")
    ).toBeVisible();

    // Message should have red styling
    const messageBox = page
      .locator("text=Failed to connect YouTube. Please try again.")
      .locator("..");
    await expect(messageBox).toHaveClass(/bg-red-900/);
  });

  test("should show denied message when user denies OAuth", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Navigate with denied param
    await page.goto("/admin/dashboard?oauth=denied");

    // Check denied message is displayed
    await expect(
      page.locator("text=YouTube connection was denied.")
    ).toBeVisible();
  });

  test("should clear OAuth query param from URL after displaying message", async ({
    page
  }) => {
    await loginAsAdmin(page);

    // Navigate with success param
    await page.goto("/admin/dashboard?oauth=success");

    // Wait for message to appear
    await expect(
      page.locator("text=YouTube connected successfully!")
    ).toBeVisible();

    // Wait a bit for URL to update
    await page.waitForTimeout(500);

    // Check URL has been cleaned (no query param)
    expect(page.url()).toBe("http://localhost:3000/admin/dashboard");
  });
});
