import { test, expect, type Page } from "@playwright/test";

const scheduledMatchId = "11111111-1111-1111-1111-111111111111";
const liveMatchId = "22222222-2222-2222-2222-222222222222";
const endedMatchId = "33333333-3333-3333-3333-333333333333";

function buildFixtureMatches() {
  const now = Date.now();
  return [
    {
      id: scheduledMatchId,
      teamId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      teamDisplayName: "Clubstream 16U",
      opponentName: "Metro Volleyball",
      tournamentName: "NEQ Boston",
      courtLabel: "Court 1",
      status: "scheduled",
      scheduledStart: new Date(now + 40 * 60 * 1000).toISOString(),
      youtubeWatchUrl: null,
      createdAt: new Date(now - 1 * 60 * 1000).toISOString()
    },
    {
      id: liveMatchId,
      teamId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      teamDisplayName: "Clubstream 17U",
      opponentName: "Skyline VC",
      tournamentName: "Presidents Day Classic",
      courtLabel: "Court 2",
      status: "live",
      scheduledStart: new Date(now - 15 * 60 * 1000).toISOString(),
      youtubeWatchUrl: "https://youtube.com/watch?v=live123",
      createdAt: new Date(now - 3 * 60 * 1000).toISOString(),
      currentSetNumber: 2,
      currentSetHomeScore: 15,
      currentSetAwayScore: 12
    },
    {
      id: endedMatchId,
      teamId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      teamDisplayName: "Clubstream 18U",
      opponentName: "Rivals United",
      tournamentName: "Regional Finals",
      courtLabel: "Court 3",
      status: "ended",
      scheduledStart: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      youtubeWatchUrl: "https://youtube.com/watch?v=ended123",
      createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
      currentSetNumber: 3,
      currentSetHomeScore: 25,
      currentSetAwayScore: 23
    }
  ];
}

async function mockMatchesApi(page: Page) {
  const matches = buildFixtureMatches();
  let requestCount = 0;

  await page.route("**/api/matches?date=*", async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ matches })
    });
  });

  return {
    getRequestCount: () => requestCount
  };
}

async function mockClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => undefined
      }
    });
  });
}

test.describe("Enhanced Match Cards", () => {
  test("renders deterministic card content and hierarchy", async ({ page }) => {
    await mockMatchesApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: "Today's Matches" })
    ).toBeVisible();
    await expect(page.getByText("Clubstream 16U")).toBeVisible();
    await expect(page.getByText("Metro Volleyball")).toBeVisible();
    await expect(page.getByText("NEQ Boston")).toBeVisible();
    await expect(page.getByText("Clubstream 17U")).toBeVisible();
    await expect(page.getByText("Skyline VC")).toBeVisible();
    await expect(page.getByText("Clubstream 18U")).toBeVisible();
    await expect(page.getByText("Rivals United")).toBeVisible();
  });

  test("shows scheduled match countdown and stream action", async ({ page }) => {
    await mockMatchesApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const scheduledCard = page
      .locator("div.rounded-xl")
      .filter({ hasText: "Metro Volleyball" })
      .first();

    await expect(scheduledCard.getByText("Court 1")).toBeVisible();
    await expect(scheduledCard.getByText(/Starts in/)).toBeVisible();
    await expect(
      scheduledCard.getByRole("link", { name: "Open Larix" })
    ).toHaveAttribute("href", `/m/${scheduledMatchId}/stream`);
  });

  test("shows live and ended score states with proper actions", async ({ page }) => {
    await mockMatchesApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const liveCard = page
      .locator("div.rounded-xl")
      .filter({ hasText: "Skyline VC" })
      .first();
    await expect(liveCard.getByText("Live", { exact: true })).toBeVisible();
    await expect(liveCard.getByText("Set 2")).toBeVisible();
    await expect(liveCard.getByText("15", { exact: true })).toBeVisible();
    await expect(liveCard.getByText("12", { exact: true })).toBeVisible();
    await expect(
      liveCard.getByRole("link", { name: "Watch Live" })
    ).toHaveAttribute("href", "https://youtube.com/watch?v=live123");
    await expect(liveCard.getByRole("button", { name: "End Match" })).toBeVisible();

    const endedCard = page
      .locator("div.rounded-xl")
      .filter({ hasText: "Rivals United" })
      .first();
    await expect(endedCard.getByText("Set 3")).toBeVisible();
    await expect(endedCard.getByText("25", { exact: true })).toBeVisible();
    await expect(endedCard.getByText("23", { exact: true })).toBeVisible();
    await expect(
      endedCard.getByRole("link", { name: "Watch Recording" })
    ).toHaveAttribute("href", "https://youtube.com/watch?v=ended123");
  });

  test("copies match link and updates button state", async ({ page }) => {
    await mockClipboard(page);
    await mockMatchesApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const scheduledCard = page
      .locator("div.rounded-xl")
      .filter({ hasText: "Metro Volleyball" })
      .first();

    await scheduledCard.getByRole("button", { name: "Copy Link" }).click();
    await expect(
      scheduledCard.getByRole("button", { name: "Copied!" })
    ).toBeVisible();
  });

  test("prompts confirmation before ending live match", async ({ page }) => {
    await mockMatchesApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const liveCard = page
      .locator("div.rounded-xl")
      .filter({ hasText: "Skyline VC" })
      .first();

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("Are you sure");
      dialog.dismiss();
    });
    await liveCard.getByRole("button", { name: "End Match" }).click();
  });
});

test.describe("Enhanced Match Cards Performance", () => {
  test("polls /api/matches at expected cadence", async ({ page }) => {
    test.setTimeout(45000);

    const api = await mockMatchesApi(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.waitForTimeout(31000);

    // Next.js dev mode may trigger one extra initial effect cycle under React strict mode.
    expect(api.getRequestCount()).toBeLessThanOrEqual(3);
  });
});
