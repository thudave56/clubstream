import { and, gte, lt, or, isNull } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { matches, adminSettings } from "@/db/schema";
import {
  createMatch,
  createMatchSchema,
  NoStreamsAvailableError
} from "@/lib/match-creation";
import { getPoolStatus } from "@/lib/stream-pool";
import { verifyPin } from "@/lib/auth";
import {
  matchCreationLimiter,
  pinAttemptLimiter
} from "@/lib/match-rate-limit";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const querySchema = z
  .object({
    date: z.string().optional()
  })
  .refine(
    (data) => !data.date || /^\d{4}-\d{2}-\d{2}$/.test(data.date),
    "date must be YYYY-MM-DD"
  );

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parseResult = querySchema.safeParse({
    date: url.searchParams.get("date") ?? undefined
  });

  if (!parseResult.success) {
    return Response.json({ error: "Invalid date format." }, { status: 400 });
  }

  if (parseResult.data.date) {
    const start = new Date(`${parseResult.data.date}T00:00:00.000Z`);
    const end = new Date(`${parseResult.data.date}T23:59:59.999Z`);
    const rows = await db
      .select()
      .from(matches)
      .where(
        or(
          // Match by scheduledStart when set
          and(gte(matches.scheduledStart, start), lt(matches.scheduledStart, end)),
          // Fall back to createdAt when scheduledStart is null
          and(isNull(matches.scheduledStart), gte(matches.createdAt, start), lt(matches.createdAt, end))
        )
      );

    return Response.json({ matches: rows });
  }

  const rows = await db.select().from(matches);
  return Response.json({ matches: rows });
}

/** Extended schema for public match creation (adds optional create_pin) */
const publicCreateMatchSchema = createMatchSchema.extend({
  create_pin: z.string().min(4).max(20).optional(),
  tournamentName: z.string().min(1).max(120).optional()
});

/**
 * POST /api/matches
 * Public match creation with optional PIN verification and rate limiting.
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Rate limit match creation
  if (matchCreationLimiter.isRateLimited(ip)) {
    return Response.json(
      {
        error: "Too many requests",
        message: "Match creation rate limit exceeded. Please try again later.",
        retryAfter: matchCreationLimiter.getResetTime(ip)
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const validated = publicCreateMatchSchema.parse(body);

    // Check if PIN is required
    const settings = await db
      .select({
        requireCreatePin: adminSettings.requireCreatePin,
        createPinHash: adminSettings.createPinHash
      })
      .from(adminSettings)
      .where(eq(adminSettings.id, 1))
      .limit(1);

    const setting = settings[0];

    if (setting?.requireCreatePin) {
      if (!setting.createPinHash) {
        return Response.json(
          {
            error: "PIN not configured",
            message:
              "Match creation PIN is required but not yet configured. Contact admin."
          },
          { status: 503 }
        );
      }

      if (!validated.create_pin) {
        return Response.json(
          {
            error: "PIN required",
            message: "A PIN is required to create matches."
          },
          { status: 403 }
        );
      }

      // Rate limit PIN attempts
      if (pinAttemptLimiter.isRateLimited(ip)) {
        return Response.json(
          {
            error: "Too many PIN attempts",
            retryAfter: pinAttemptLimiter.getResetTime(ip)
          },
          { status: 429 }
        );
      }

      if (!verifyPin(validated.create_pin, setting.createPinHash)) {
        pinAttemptLimiter.recordAttempt(ip);
        return Response.json(
          { error: "Invalid PIN" },
          { status: 401 }
        );
      }

      // Clear PIN attempts on success
      pinAttemptLimiter.clearAttempts(ip);
    }

    // Strip create_pin and sanitize text fields before passing to createMatch
    const { create_pin, ...matchParams } = validated;
    matchParams.opponentName = sanitizeText(matchParams.opponentName);
    if (matchParams.tournamentName) {
      matchParams.tournamentName = sanitizeText(matchParams.tournamentName);
    }
    if (matchParams.courtLabel) {
      matchParams.courtLabel = sanitizeText(matchParams.courtLabel);
    }

    // Record match creation attempt for rate limiting
    matchCreationLimiter.recordAttempt(ip);

    const result = await createMatch(matchParams);

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("Public match creation error:", error);

    if (error instanceof NoStreamsAvailableError) {
      const poolStatus = await getPoolStatus();
      return Response.json(
        {
          error: "No streams available",
          message:
            "All streams are currently in use. Please wait for a match to end or contact admin.",
          poolStatus
        },
        { status: 503 }
      );
    }

    if (error instanceof Error && error.name === "ZodError") {
      return Response.json(
        { error: "Validation error", message: error.message },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === "Team not found") {
        return Response.json(
          { error: "Invalid team", message: "The specified team does not exist" },
          { status: 400 }
        );
      }
      if (error.message === "Tournament not found") {
        return Response.json(
          {
            error: "Invalid tournament",
            message: "The specified tournament does not exist"
          },
          { status: 400 }
        );
      }
      return Response.json(
        { error: "Match creation failed", message: error.message },
        { status: 500 }
      );
    }

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
