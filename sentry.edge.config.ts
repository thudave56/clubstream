import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = Number.parseFloat(
  process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"
);

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
  enabled: Boolean(process.env.SENTRY_DSN)
});
