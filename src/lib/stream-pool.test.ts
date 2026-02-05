import {
  createYouTubeStream,
  initializeStreamPool,
  getPoolStatus,
  reserveStream,
  releaseStream
} from "./stream-pool";
import { getYouTubeClient } from "./youtube-auth";
import { db } from "@/db";
import { streamPool } from "@/db/schema";
import { eq } from "drizzle-orm";
import { vi } from "vitest";

// Mock dependencies
vi.mock("./youtube-auth");
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn()
  }
}));

describe("stream-pool", () => {
  describe("createYouTubeStream", () => {
    it("should create a YouTube stream and return stream data", async () => {
      const mockYouTube = {
        liveStreams: {
          insert: vi.fn().mockResolvedValue({
            data: {
              id: "test-stream-id",
              cdn: {
                ingestionInfo: {
                  ingestionAddress: "rtmp://a.rtmp.youtube.com/live2",
                  streamName: "test-stream-key"
                }
              }
            }
          })
        }
      };

      vi.mocked(getYouTubeClient).mockResolvedValue(mockYouTube as any);

      const result = await createYouTubeStream("Test Stream");

      expect(result).toEqual({
        streamId: "test-stream-id",
        ingestAddress: "rtmp://a.rtmp.youtube.com/live2",
        streamName: "test-stream-key"
      });

      expect(mockYouTube.liveStreams.insert).toHaveBeenCalledWith({
        part: ["snippet", "cdn"],
        requestBody: {
          snippet: { title: "Test Stream" },
          cdn: {
            frameRate: "variable",
            ingestionType: "rtmp",
            resolution: "720p"
          }
        }
      });
    });

    it("should throw error if YouTube API fails", async () => {
      const mockYouTube = {
        liveStreams: {
          insert: vi.fn().mockRejectedValue(new Error("API Error"))
        }
      };

      vi.mocked(getYouTubeClient).mockResolvedValue(mockYouTube as any);

      await expect(createYouTubeStream("Test Stream")).rejects.toThrow("API Error");
    });

    it("should throw error if response is missing required fields", async () => {
      const mockYouTube = {
        liveStreams: {
          insert: vi.fn().mockResolvedValue({
            data: {
              id: null,
              cdn: null
            }
          })
        }
      };

      vi.mocked(getYouTubeClient).mockResolvedValue(mockYouTube as any);

      await expect(createYouTubeStream("Test Stream")).rejects.toThrow(
        "Invalid response from YouTube API"
      );
    });
  });

  describe("initializeStreamPool", () => {
    it("should validate count is between 1 and 20", async () => {
      await expect(initializeStreamPool(0)).rejects.toThrow(
        "Count must be between 1 and 20"
      );

      await expect(initializeStreamPool(21)).rejects.toThrow(
        "Count must be between 1 and 20"
      );
    });

    it("should create multiple streams and insert into database", async () => {
      const mockYouTube = {
        liveStreams: {
          insert: vi.fn().mockResolvedValue({
            data: {
              id: "test-stream-id",
              cdn: {
                ingestionInfo: {
                  ingestionAddress: "rtmp://a.rtmp.youtube.com/live2",
                  streamName: "test-stream-key"
                }
              }
            }
          })
        }
      };

      vi.mocked(getYouTubeClient).mockResolvedValue(mockYouTube as any);

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      (db.insert as any).mockReturnValue({
        values: mockInsert().values
      });

      const result = await initializeStreamPool(3);

      expect(result.created).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(mockYouTube.liveStreams.insert).toHaveBeenCalledTimes(3);
    });

    it("should handle partial failures", async () => {
      let callCount = 0;
      const mockYouTube = {
        liveStreams: {
          insert: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 2) {
              return Promise.reject(new Error("API Failure"));
            }
            return Promise.resolve({
              data: {
                id: `test-stream-${callCount}`,
                cdn: {
                  ingestionInfo: {
                    ingestionAddress: "rtmp://a.rtmp.youtube.com/live2",
                    streamName: "test-stream-key"
                  }
                }
              }
            });
          })
        }
      };

      vi.mocked(getYouTubeClient).mockResolvedValue(mockYouTube as any);

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      (db.insert as any).mockReturnValue({
        values: mockInsert().values
      });

      const result = await initializeStreamPool(3);

      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(2);
    });
  });

  describe("getPoolStatus", () => {
    it("should return counts grouped by status", async () => {
      const mockStreams = [
        { id: "1", status: "available" },
        { id: "2", status: "available" },
        { id: "3", status: "reserved" },
        { id: "4", status: "in_use" },
        { id: "5", status: "stuck" }
      ];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue(mockStreams)
      });

      (db.select as any).mockReturnValue({
        from: mockSelect().from
      });

      const result = await getPoolStatus();

      expect(result).toEqual({
        available: 2,
        reserved: 1,
        in_use: 1,
        stuck: 1,
        disabled: 0,
        total: 5
      });
    });

    it("should return zero counts for empty pool", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValue([])
      });

      (db.select as any).mockReturnValue({
        from: mockSelect().from
      });

      const result = await getPoolStatus();

      expect(result).toEqual({
        available: 0,
        reserved: 0,
        in_use: 0,
        stuck: 0,
        disabled: 0,
        total: 0
      });
    });
  });

  describe("reserveStream", () => {
    it("should reserve first available stream", async () => {
      const mockStream = {
        id: "pool-id-1",
        youtubeStreamId: "youtube-stream-1",
        ingestAddress: "rtmp://test.youtube.com/live2",
        streamName: "test-key-1",
        status: "available"
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockStream])
          })
        })
      });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      (db.select as any).mockReturnValue({
        from: mockSelect().from
      });

      (db.update as any).mockReturnValue({
        set: mockUpdate().set
      });

      const result = await reserveStream("match-123");

      expect(result).toEqual({
        streamId: "youtube-stream-1",
        ingestAddress: "rtmp://test.youtube.com/live2",
        streamName: "test-key-1"
      });
    });

    it("should return null if no streams available", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      (db.select as any).mockReturnValue({
        from: mockSelect().from
      });

      const result = await reserveStream("match-123");

      expect(result).toBeNull();
    });
  });

  describe("releaseStream", () => {
    it("should reset stream to available status", async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      (db.update as any).mockReturnValue({
        set: mockUpdate().set
      });

      await releaseStream("youtube-stream-1");

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = mockUpdate().set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "available",
          reservedMatchId: null
        })
      );
    });
  });
});
