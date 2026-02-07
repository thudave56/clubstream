import { test, expect } from "@playwright/test";

test.describe("Regression: scoring + overlay realtime updates", () => {
  test("overlay reflects score updates within ~2s", async ({ page, request }) => {
    // Prepare non-prod state.
    await expect(
      (await request.post("http://localhost:3000/api/admin/test-oauth-connect")).ok()
    ).toBeTruthy();
    await expect(
      (await request.post("http://localhost:3000/api/admin/test-stream-pool")).ok()
    ).toBeTruthy();

    // Pick an enabled team.
    const teamsRes = await request.get("http://localhost:3000/api/teams");
    expect(teamsRes.ok()).toBeTruthy();
    const teamsPayload = await teamsRes.json();
    const teamId = teamsPayload.teams?.[0]?.id as string | undefined;
    expect(teamId).toBeTruthy();

    // Create a match (YouTube calls are mocked in CI/dev when Google creds are absent).
    const createRes = await request.post("http://localhost:3000/api/matches", {
      headers: { "x-test-client-ip": "203.0.113.44" },
      data: {
        teamId,
        opponentName: "Regression Opponent",
        courtLabel: "Court 1",
        privacyStatus: "unlisted",
        idempotencyKey: `pw-regression-${Date.now()}`
      }
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const matchId = created.match?.id as string | undefined;
    expect(matchId).toBeTruthy();

    const overlayPage = await page.context().newPage();

    await page.goto(`/m/${matchId}/score`, { waitUntil: "networkidle" });
    await overlayPage.goto(`/m/${matchId}/overlay`, { waitUntil: "networkidle" });

    // Initial state should be 0-0.
    await expect(page.getByTestId("score-home")).toHaveText("0");
    await expect(page.getByTestId("score-away")).toHaveText("0");
    await expect(overlayPage.getByTestId("overlay-home")).toHaveText("0");
    await expect(overlayPage.getByTestId("overlay-away")).toHaveText("0");

    // Update score via API, then verify both clients reflect it quickly.
    const scoreRes = await request.post(
      `http://localhost:3000/api/matches/${matchId}/score`,
      {
        headers: { "x-test-client-ip": "203.0.113.44" },
        data: { action: "home_plus" }
      }
    );
    expect(scoreRes.ok()).toBeTruthy();

    await expect(page.getByTestId("score-home")).toHaveText("1", { timeout: 2000 });
    await expect(overlayPage.getByTestId("overlay-home")).toHaveText("1", {
      timeout: 2000
    });
  });
});

