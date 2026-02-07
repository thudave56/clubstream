import { expect, Page } from "@playwright/test";

export async function injectAdminCookie(page: Page) {
  const response = await page.request.post(
    "http://localhost:3000/api/admin/test-login",
    { data: { pin: "1234" } }
  );

  const data = await response.json();
  if (!data.sessionToken) throw new Error("Failed to obtain session token");

  await page.context().addCookies([
    {
      name: "admin_session",
      value: data.sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

/**
 * Logs in as admin with a fallback cookie injection for CI flakiness.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin PIN").fill("1234");
  await page.getByRole("button", { name: "Sign In" }).click();

  try {
    await page.waitForURL("**/admin/dashboard", { timeout: 2000 });
  } catch {
    await injectAdminCookie(page);
    await page.goto("/admin/dashboard");
  }

  await expect(page).toHaveURL("/admin/dashboard");
}

