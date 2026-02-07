const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()"
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains"
      }
    ];

    return [
      {
        // Overlay page needs SAMEORIGIN for Larix widget embedding
        source: "/m/:id/overlay",
        headers: [
          ...securityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" }
        ]
      },
      {
        // All other routes deny framing
        source: "/((?!m/[^/]+/overlay).*)",
        headers: [
          ...securityHeaders,
          { key: "X-Frame-Options", value: "DENY" }
        ]
      }
    ];
  }
};

module.exports = withSentryConfig(nextConfig, {
  // Keep CI logs focused unless troubleshooting source-map upload.
  silent: true,
  treeshake: {
    removeDebugLogging: true
  }
});
