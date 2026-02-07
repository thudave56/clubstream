import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { matches, scores } from "@/db/schema";
import { computeMatchState, validateRules, type MatchRules } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().uuid()
});

function rulesFromMatch(match: {
  rulesBestOf: number;
  rulesPointsToWin: number;
  rulesFinalSetPoints: number;
  rulesWinBy: number;
}): MatchRules {
  return {
    bestOf: match.rulesBestOf,
    pointsToWin: match.rulesPointsToWin,
    finalSetPoints: match.rulesFinalSetPoints,
    winBy: match.rulesWinBy
  };
}

type ScoreStreamPayload = {
  matchId: string;
  setNumber: number;
  homeScore: number;
  awayScore: number;
  updatedAt: string;
  matchStatus: string;
  matchComplete: boolean;
};

async function getSnapshot(matchId: string): Promise<ScoreStreamPayload | null> {
  const matchRows = await db
    .select({
      id: matches.id,
      status: matches.status,
      rulesBestOf: matches.rulesBestOf,
      rulesPointsToWin: matches.rulesPointsToWin,
      rulesFinalSetPoints: matches.rulesFinalSetPoints,
      rulesWinBy: matches.rulesWinBy,
      updatedAt: matches.updatedAt,
      createdAt: matches.createdAt
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (matchRows.length === 0) return null;

  const match = matchRows[0];
  const rules = rulesFromMatch(match);
  const rulesError = validateRules(rules);
  if (rulesError) {
    // Treat invalid rules as terminal; clients will fall back to polling and see the error.
    return {
      matchId,
      setNumber: 1,
      homeScore: 0,
      awayScore: 0,
      updatedAt: (match.updatedAt ?? match.createdAt).toISOString(),
      matchStatus: match.status,
      matchComplete: false
    };
  }

  const setRows = await db
    .select({
      setNumber: scores.setNumber,
      homeScore: scores.homeScore,
      awayScore: scores.awayScore,
      updatedAt: scores.updatedAt
    })
    .from(scores)
    .where(eq(scores.matchId, matchId));

  const state = computeMatchState(
    setRows.map((r) => ({
      setNumber: r.setNumber,
      homeScore: r.homeScore,
      awayScore: r.awayScore
    })),
    rules
  );

  const currentSetNumber = state.currentSetNumber;
  const current = setRows.find((r) => r.setNumber === currentSetNumber) || null;
  const lastUpdatedAt =
    current?.updatedAt ||
    setRows.reduce<Date | null>((acc, row) => {
      if (!acc) return row.updatedAt;
      return row.updatedAt > acc ? row.updatedAt : acc;
    }, null) ||
    match.updatedAt ||
    match.createdAt;

  return {
    matchId,
    setNumber: currentSetNumber,
    homeScore: current?.homeScore ?? 0,
    awayScore: current?.awayScore ?? 0,
    updatedAt: lastUpdatedAt.toISOString(),
    matchStatus: match.status,
    matchComplete: state.matchComplete
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sseEncode(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * GET /api/matches/:id/score/stream
 * SSE stream that emits when score state changes.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const parse = paramsSchema.safeParse(params);
  if (!parse.success) {
    return Response.json({ error: "Invalid match id" }, { status: 400 });
  }

  const matchId = parse.data.id;

  // Validate match existence up-front.
  const exists = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.id, matchId)))
    .limit(1);

  if (exists.length === 0) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener("abort", close);

      // Send an initial snapshot immediately.
      try {
        const snapshot = await getSnapshot(matchId);
        if (snapshot) controller.enqueue(encoder.encode(sseEncode(snapshot)));
      } catch {
        // If the initial snapshot fails, keep the stream open and retry in the loop.
      }

      let lastFingerprint = "";

      // Keepalive ping to keep proxies from buffering the stream.
      const pingInterval = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      try {
        while (!closed) {
          try {
            const snapshot = await getSnapshot(matchId);
            if (snapshot) {
              const fingerprint = `${snapshot.setNumber}:${snapshot.homeScore}:${snapshot.awayScore}:${snapshot.updatedAt}:${snapshot.matchStatus}:${snapshot.matchComplete}`;
              if (fingerprint !== lastFingerprint) {
                lastFingerprint = fingerprint;
                controller.enqueue(encoder.encode(sseEncode(snapshot)));
              }
            }
          } catch {
            // Ignore transient DB errors; clients will keep their last known score.
          }

          await sleep(1000);
        }
      } finally {
        clearInterval(pingInterval);
        close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

