import { vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn()
  }
}));

vi.mock("@/db/schema", () => ({
  matches: { idempotencyKey: "idempotencyKey", id: "id" },
  teams: { id: "id", displayName: "displayName" },
  tournaments: { id: "id", name: "name" },
  auditLog: {},
  adminSettings: {},
  streamPool: {},
  scores: {}
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({}))
}));

vi.mock("./stream-pool", () => ({
  reserveStream: vi.fn(),
  releaseStream: vi.fn(),
  getStreamByMatchId: vi.fn(),
  updateStreamReservation: vi.fn()
}));

vi.mock("./youtube-auth", () => ({
  getYouTubeClient: vi.fn()
}));

vi.mock("./youtube-title", () => ({
  buildYouTubeTitle: vi.fn(() => "Mock Title"),
  buildYouTubeDescription: vi.fn(() => "Mock Description")
}));

describe("match-creation service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.APP_BASE_URL;
  });

  async function load() {
    const matchCreation = await import("./match-creation");
    const { db } = await import("@/db");
    const streamPool = await import("./stream-pool");
    const youtubeAuth = await import("./youtube-auth");
    return { matchCreation, db, streamPool, youtubeAuth };
  }

  describe("createYouTubeBroadcast", () => {
    it("returns broadcastId + watchUrl and binds stream", async () => {
      const { matchCreation, youtubeAuth } = await load();

      const insert = vi.fn().mockResolvedValue({ data: { id: "abc123" } });
      const bind = vi.fn().mockResolvedValue({ data: {} });
      (youtubeAuth.getYouTubeClient as any).mockResolvedValue({
        liveBroadcasts: { insert, bind }
      });

      const res = await matchCreation.createYouTubeBroadcast(
        {
          title: "T",
          description: "D",
          scheduledStart: new Date("2026-01-01T00:00:00.000Z"),
          privacyStatus: "unlisted"
        },
        "stream-1"
      );

      expect(res).toEqual({
        broadcastId: "abc123",
        watchUrl: "https://youtube.com/watch?v=abc123"
      });
      expect(insert).toHaveBeenCalled();
      expect(bind).toHaveBeenCalledWith(
        expect.objectContaining({ id: "abc123", streamId: "stream-1" })
      );
    });

    it("throws a wrapped error when YouTube returns no id", async () => {
      const { matchCreation, youtubeAuth } = await load();

      (youtubeAuth.getYouTubeClient as any).mockResolvedValue({
        liveBroadcasts: {
          insert: vi.fn().mockResolvedValue({ data: { id: undefined } }),
          bind: vi.fn()
        }
      });

      await expect(
        matchCreation.createYouTubeBroadcast(
          {
            title: "T",
            scheduledStart: new Date("2026-01-01T00:00:00.000Z"),
            privacyStatus: "unlisted"
          },
          "stream-1"
        )
      ).rejects.toThrow(/YouTube broadcast creation failed/);
    });
  });

  describe("createMatch", () => {
    it("throws NoStreamsAvailableError when pool is empty", async () => {
      const { matchCreation, db, streamPool } = await load();

      // team lookup
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "t1", displayName: "Team" }])
          })
        })
      });

      (streamPool.reserveStream as any).mockResolvedValue(null);

      await expect(
        matchCreation.createMatch({
          teamId: "00000000-0000-0000-0000-000000000001",
          opponentName: "Opp"
        } as any)
      ).rejects.toBeInstanceOf(matchCreation.NoStreamsAvailableError);
    });

    it("releases reserved stream if broadcast creation fails", async () => {
      const { matchCreation, db, streamPool, youtubeAuth } = await load();

      // team lookup
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "t1", displayName: "Team" }])
          })
        })
      });

      (streamPool.reserveStream as any).mockResolvedValue({
        id: "pool-1",
        youtubeStreamId: "yt-stream-1",
        streamId: "yt-stream-1",
        ingestAddress: "rtmp://x",
        streamName: "key"
      });

      (youtubeAuth.getYouTubeClient as any).mockResolvedValue({
        liveBroadcasts: {
          insert: vi.fn().mockRejectedValue(new Error("boom")),
          bind: vi.fn()
        }
      });

      await expect(
        matchCreation.createMatch({
          teamId: "00000000-0000-0000-0000-000000000001",
          opponentName: "Opp"
        } as any)
      ).rejects.toThrow();

      expect(streamPool.releaseStream).toHaveBeenCalledWith("yt-stream-1");
    });

    it("creates match + updates reservation + audits", async () => {
      const { matchCreation, db, streamPool, youtubeAuth } = await load();

      process.env.APP_BASE_URL = "http://localhost:3000";

      // team lookup
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "t1", displayName: "Team" }])
          })
        })
      });

      (streamPool.reserveStream as any).mockResolvedValue({
        id: "pool-1",
        youtubeStreamId: "yt-stream-1",
        streamId: "yt-stream-1",
        ingestAddress: "rtmp://x",
        streamName: "key"
      });

      (youtubeAuth.getYouTubeClient as any).mockResolvedValue({
        liveBroadcasts: {
          insert: vi.fn().mockResolvedValue({ data: { id: "b1" } }),
          bind: vi.fn().mockResolvedValue({ data: {} })
        }
      });

      const insertedMatch = {
        id: "match-1",
        teamId: "00000000-0000-0000-0000-000000000001",
        opponentName: "Opp",
        tournamentId: null,
        tournamentName: null,
        scheduledStart: null,
        courtLabel: null,
        status: "draft",
        youtubeBroadcastId: "b1",
        youtubeWatchUrl: "https://youtube.com/watch?v=b1",
        streamPoolId: "pool-1",
        idempotencyKey: null,
        updatedAt: new Date(),
        createdAt: new Date()
      };

      (db.insert as any)
        // match insert
        .mockImplementationOnce(() => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([insertedMatch])
          })
        }))
        // audit insert
        .mockImplementationOnce(() => ({
          values: vi.fn().mockResolvedValue(undefined)
        }));

      const result = await matchCreation.createMatch({
        teamId: "00000000-0000-0000-0000-000000000001",
        opponentName: "Opp",
        privacyStatus: "unlisted"
      } as any);

      expect(result.match.id).toBe("match-1");
      expect(result.larixUrl).toMatch(/^larix:\/\/set\/v1\?/);
      expect(streamPool.updateStreamReservation).toHaveBeenCalledWith(
        "pool-1",
        "match-1"
      );
    });

    it("returns existing match when idempotencyKey is reused", async () => {
      const { matchCreation, db, streamPool } = await load();

      const existingMatch = {
        id: "m1",
        opponentName: "Opp",
        teamId: "t1"
      };

      // idempotency lookup hits first and returns an existing match
      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([existingMatch])
          })
        })
      });

      (streamPool.getStreamByMatchId as any).mockResolvedValue({
        id: "pool-1",
        youtubeStreamId: "yt-stream-1",
        ingestAddress: "rtmp://x",
        streamName: "key",
        status: "reserved",
        reservedMatchId: "m1",
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const result = await matchCreation.createMatch({
        teamId: "00000000-0000-0000-0000-000000000001",
        opponentName: "Opp",
        idempotencyKey: "k1"
      } as any);

      expect(result.match.id).toBe("m1");
      expect(result.larixUrl).toMatch(/^larix:\/\/set\/v1\?/);
    });
  });
});
