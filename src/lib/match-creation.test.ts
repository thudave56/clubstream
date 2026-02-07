import { generateLarixUrl } from "./match-creation";

describe("match-creation", () => {
  describe("generateLarixUrl", () => {
    it("should generate valid larix:// Grove URL", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match"
      );

      expect(url).toMatch(/^larix:\/\/set\/v1\?/);
    });

    it("should include connection URL with stream key", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key-xyz",
        "Test Match"
      );

      const params = new URLSearchParams(url.replace("larix://set/v1?", ""));
      const connUrl = params.get("conn[][url]");

      expect(connUrl).toBe("rtmp://a.rtmp.youtube.com/live2/test-stream-key-xyz");
    });

    it("should include connection name from match title", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Lions vs Tigers"
      );

      const params = new URLSearchParams(url.replace("larix://set/v1?", ""));
      expect(params.get("conn[][name]")).toBe("Lions vs Tigers");
    });

    it("should include encoder settings", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match"
      );

      const params = new URLSearchParams(url.replace("larix://set/v1?", ""));

      expect(params.get("enc[vid][res]")).toBe("1280x720");
      expect(params.get("enc[vid][fps]")).toBe("30");
      expect(params.get("enc[vid][bitrate]")).toBe("2500");
      expect(params.get("enc[aud][bitrate]")).toBe("128");
    });

    it("should include record enabled param when recordLocally is true", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match",
        undefined,
        undefined,
        { recordLocally: true }
      );

      const params = new URLSearchParams(url.replace("larix://set/v1?", ""));
      expect(params.get("enc[record][enabled]")).toBe("on");
    });

    it("should not include record param when recordLocally is false", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match",
        undefined,
        undefined,
        { recordLocally: false }
      );

      const params = new URLSearchParams(url.replace("larix://set/v1?", ""));
      expect(params.get("enc[record][enabled]")).toBeNull();
    });

    it("should not include record param by default", () => {
      const url = generateLarixUrl(
        "rtmp://a.rtmp.youtube.com/live2",
        "test-stream-key",
        "Test Match"
      );

      const params = new URLSearchParams(url.replace("larix://set/v1?", ""));
      expect(params.get("enc[record][enabled]")).toBeNull();
    });
  });

  // TODO: Add tests for createMatch, createYouTubeBroadcast, and cancelMatch
  // These require mocking YouTube API and database calls
});
