import { z } from "zod";
import { db } from "@/db";
import { matches, scores, teams, tournaments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  computeMatchState,
  getSetTarget,
  isSetComplete,
  validateRules,
  type MatchRules,
  type SetScore
} from "@/lib/scoring";
import { scoringLimiter } from "@/lib/match-rate-limit";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  action: z.enum([
    "home_plus",
    "home_minus",
    "away_plus",
    "away_minus",
    "next_set",
    "reset_set"
  ]),
  override: z.boolean().optional()
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

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const matchId = params.id;

  const rows = await db
    .select({
      id: matches.id,
      teamDisplayName: teams.displayName,
      opponentName: matches.opponentName,
      status: matches.status,
      tournamentName: matches.tournamentName,
      tournamentDisplayName: tournaments.name,
      rulesBestOf: matches.rulesBestOf,
      rulesPointsToWin: matches.rulesPointsToWin,
      rulesFinalSetPoints: matches.rulesFinalSetPoints,
      rulesWinBy: matches.rulesWinBy
    })
    .from(matches)
    .innerJoin(teams, eq(matches.teamId, teams.id))
    .leftJoin(tournaments, eq(matches.tournamentId, tournaments.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Match not found" }, { status: 404 });
  }

  const match = rows[0];
  const rules = rulesFromMatch(match);
  const rulesError = validateRules(rules);
  if (rulesError) {
    return Response.json({ error: rulesError }, { status: 400 });
  }

  const setRows = await db
    .select({
      setNumber: scores.setNumber,
      homeScore: scores.homeScore,
      awayScore: scores.awayScore
    })
    .from(scores)
    .where(eq(scores.matchId, matchId));

  const state = computeMatchState(setRows, rules);

  return Response.json({
    match: {
      id: match.id,
      teamDisplayName: match.teamDisplayName,
      opponentName: match.opponentName,
      tournamentName: match.tournamentDisplayName || match.tournamentName,
      status: match.status
    },
    rules,
    state
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (scoringLimiter.isRateLimited(ip)) {
    return Response.json(
      {
        error: "Too many requests",
        retryAfter: scoringLimiter.getResetTime(ip)
      },
      { status: 429 }
    );
  }

  scoringLimiter.recordAttempt(ip);

  const matchId = params.id;
  const body = await request.json();
  const parsed = actionSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid action", details: parsed.error.errors },
      { status: 400 }
    );
  }

  const { action, override } = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const matchRows = await tx
        .select({
          id: matches.id,
          rulesBestOf: matches.rulesBestOf,
          rulesPointsToWin: matches.rulesPointsToWin,
          rulesFinalSetPoints: matches.rulesFinalSetPoints,
          rulesWinBy: matches.rulesWinBy
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .limit(1);

      if (matchRows.length === 0) {
        return { error: "Match not found", status: 404 as const };
      }

      const match = matchRows[0];
      const rules = rulesFromMatch(match);
      const rulesError = validateRules(rules);
      if (rulesError) {
        return { error: rulesError, status: 400 as const };
      }

      const setRows = await tx
        .select({
          setNumber: scores.setNumber,
          homeScore: scores.homeScore,
          awayScore: scores.awayScore
        })
        .from(scores)
        .where(eq(scores.matchId, matchId));

      const state = computeMatchState(setRows, rules);
      const targetSetNumber = state.currentSetNumber;

      const currentSet =
        setRows.find((set) => set.setNumber === targetSetNumber) || null;

      const ensureSet = async (): Promise<SetScore> => {
        if (currentSet) return currentSet;

        const inserted = await tx
          .insert(scores)
          .values({
            matchId,
            setNumber: targetSetNumber,
            homeScore: 0,
            awayScore: 0,
            updatedAt: new Date()
          })
          .returning({
            setNumber: scores.setNumber,
            homeScore: scores.homeScore,
            awayScore: scores.awayScore
          });

        return inserted[0];
      };

      if (action === "next_set") {
        if (!override) {
          if (state.matchComplete) {
            return { error: "Match already complete", status: 400 as const };
          }
          const lastSet = setRows.find((set) => set.setNumber === targetSetNumber);
          if (lastSet) {
            const target = getSetTarget(rules, lastSet.setNumber);
            if (!isSetComplete(lastSet.homeScore, lastSet.awayScore, target, rules.winBy)) {
              return { error: "Current set is not complete", status: 400 as const };
            }
          }
        }

        const nextSetNumber = targetSetNumber + 1;
        if (nextSetNumber > rules.bestOf) {
          return { error: "No more sets available", status: 400 as const };
        }
        const existingNext = setRows.find((set) => set.setNumber === nextSetNumber);
        if (!existingNext) {
          await tx.insert(scores).values({
            matchId,
            setNumber: nextSetNumber,
            homeScore: 0,
            awayScore: 0,
            updatedAt: new Date()
          });
        }
      } else if (action === "reset_set") {
        const setToReset = await ensureSet();
        await tx
          .update(scores)
          .set({
            homeScore: 0,
            awayScore: 0,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(scores.matchId, matchId),
              eq(scores.setNumber, setToReset.setNumber)
            )
          );
      } else {
        const setToUpdate = await ensureSet();

        const target = getSetTarget(rules, setToUpdate.setNumber);
        const complete = isSetComplete(
          setToUpdate.homeScore,
          setToUpdate.awayScore,
          target,
          rules.winBy
        );

        if (!override && complete) {
          return { error: "Set already complete", status: 400 as const };
        }

        let nextHome = setToUpdate.homeScore;
        let nextAway = setToUpdate.awayScore;

        if (action === "home_plus") nextHome += 1;
        if (action === "away_plus") nextAway += 1;
        if (action === "home_minus") nextHome = Math.max(0, nextHome - 1);
        if (action === "away_minus") nextAway = Math.max(0, nextAway - 1);

        await tx
          .update(scores)
          .set({
            homeScore: nextHome,
            awayScore: nextAway,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(scores.matchId, matchId),
              eq(scores.setNumber, setToUpdate.setNumber)
            )
          );
      }

      const updatedRows = await tx
        .select({
          setNumber: scores.setNumber,
          homeScore: scores.homeScore,
          awayScore: scores.awayScore
        })
        .from(scores)
        .where(eq(scores.matchId, matchId));

      const updatedState = computeMatchState(updatedRows, rules);

      return { state: updatedState, rules };
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Score update error:", error);
    return Response.json(
      { error: "Failed to update score" },
      { status: 500 }
    );
  }
}
