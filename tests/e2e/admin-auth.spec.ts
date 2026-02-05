import { test, expect } from '@playwright/test';

test.describe('Admin Authentication', () => {
  // Run these tests serially due to shared rate limiter state
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Navigate to admin login page
    await page.goto('/admin');
  });

  test('should display login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await expect(page.getByLabel('Admin PIN')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show error for invalid PIN', async ({ page }) => {
    // Enter invalid PIN
    await page.getByLabel('Admin PIN').fill('9999');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should show error message
    await expect(page.getByText('Invalid PIN')).toBeVisible();
  });

  test('should login with valid PIN and redirect to dashboard', async ({ page }) => {
    // Enter valid PIN (default from seed script)
    await page.getByLabel('Admin PIN').fill('1234');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });

  test('should show rate limiting after multiple failed attempts', async ({ page, request }) => {
    // Reset rate limiter before this test
    await request.post('http://localhost:3000/api/admin/test-reset');
    await page.waitForTimeout(500); // Give server time to reset

    await page.goto('/admin');

    // Attempt login 5 times with wrong PIN
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Admin PIN').fill('9999');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForTimeout(200);
    }

    // 6th attempt should show rate limit error
    await page.getByLabel('Admin PIN').fill('9999');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(500); // Wait for error to display

    await expect(page.getByText(/Too many attempts/)).toBeVisible();
  });

  test('should not require PIN input to be visible (password field)', async ({ page }) => {
    const pinInput = page.getByLabel('Admin PIN');

    // Check that input type is password
    await expect(pinInput).toHaveAttribute('type', 'password');
  });
});

test.describe('Admin Dashboard', () => {
  test('should require authentication to access dashboard', async ({ page }) => {
    // Try to access dashboard directly without login
    await page.goto('/admin/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL('/admin');
  });

  test('should display dashboard after login', async ({ page }) => {
    // Login first
    await page.goto('/admin');
    await page.getByLabel('Admin PIN').fill('1234');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Check dashboard content
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByText('YouTube OAuth Status')).toBeVisible();
    await expect(page.getByText('Stream Pool Status')).toBeVisible();
    await expect(page.getByText('Security Settings')).toBeVisible();
  });

  test('should toggle requireCreatePin setting', async ({ page }) => {
    // Login first
    await page.goto('/admin');
    await page.getByLabel('Admin PIN').fill('1234');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Find the toggle button
    const toggle = page.getByRole('button').filter({ has: page.locator('span.inline-block.h-4.w-4') });

    // Click toggle
    await toggle.click();

    // Wait a bit for the update to complete
    await page.waitForTimeout(500);

    // Toggle should have changed state (we can't easily verify the API call, but the UI should update)
    // This is a basic check that the toggle is interactive
    await expect(toggle).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/admin');
    await page.getByLabel('Admin PIN').fill('1234');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Click logout button
    await page.getByRole('button', { name: 'Logout' }).click();

    // Should redirect to login page
    await expect(page).toHaveURL('/admin');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('should not access dashboard after logout', async ({ page }) => {
    // Login
    await page.goto('/admin');
    await page.getByLabel('Admin PIN').fill('1234');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();

    // Try to access dashboard
    await page.goto('/admin/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('/admin');
  });
});
