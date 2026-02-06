import { describe, it, expect } from "vitest";
import { generateLarixUrl } from "./match-creation";

describe("match-creation", () => {
  describe("generateLarixUrl", () => {
    it("should generate valid larix:// URL", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match"
      );

      expect(url).toMatch(/^larix:\/\/set\//);
    });

    it("should have decodable base64 payload", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match"
      );

      const base64Part = url.replace("larix://set/", "");
      const decoded = Buffer.from(base64Part, "base64").toString("utf-8");
      const config = JSON.parse(decoded);

      expect(config).toHaveProperty("connections");
      expect(config).toHaveProperty("video");
      expect(config).toHaveProperty("audio");
      expect(config.connections[0].url).toContain("test-stream-key");
    });

    it("should include correct encoder settings", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match"
      );

      const base64Part = url.replace("larix://set/", "");
      const config = JSON.parse(Buffer.from(base64Part, "base64").toString("utf-8"));

      expect(config.video).toEqual({
        resolution: "1280x720",
        fps: 30,
        bitrate: 2500000
      });

      expect(config.audio).toEqual({
        bitrate: 128000
      });
    });

    it("should include RTMP URL with stream key", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key-xyz",
        "Test Match"
      );

      const base64Part = url.replace("larix://set/", "");
      const config = JSON.parse(Buffer.from(base64Part, "base64").toString("utf-8"));

      expect(config.connections[0].url).toBe(
        "rtmp://a.rtmp.youtube.com/live2/test-stream-key-xyz"
      );
      expect(config.connections[0].autoReconnect).toBe(true);
      expect(config.connections[0].record).toBe(true);
    });
  });

  // TODO: Add tests for createMatch, createYouTubeBroadcast, and cancelMatch
  // These require mocking YouTube API and database calls
});
