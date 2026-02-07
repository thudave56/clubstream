import * as Sentry from "@sentry/nextjs";

const tracesSampleRate = Number.parseFloat(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0"
);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
