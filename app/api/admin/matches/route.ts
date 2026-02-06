import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import {
  createMatch,
  createMatchSchema,
  NoStreamsAvailableError
} from "@/lib/match-creation";
import { getPoolStatus } from "@/lib/stream-pool";

/**
 * POST /api/admin/matches
 * Create a new match with YouTube broadcast and stream assignment
 */
export async function POST(request: Request) {
  // Check admin authentication
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = createMatchSchema.parse(body);

    // Create match (includes stream reservation, broadcast creation, and Larix URL generation)
    const result = await createMatch(validated);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Match creation error:", error);

    // Handle no streams available
    if (error instanceof NoStreamsAvailableError) {
      const poolStatus = await getPoolStatus();

      return NextResponse.json(
        {
          error: "No streams available",
          message:
            "Stream pool is exhausted. Please wait for active matches to end or add more streams.",
          poolStatus
        },
        { status: 503 }
      );
    }

    // Handle Zod validation errors
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        {
          error: "Validation error",
          message: error.message
        },
        { status: 400 }
      );
    }

    // Handle specific error messages
    if (error instanceof Error) {
      if (error.message === "Team not found") {
        return NextResponse.json(
          {
            error: "Invalid team",
            message: "The specified team does not exist"
          },
          { status: 400 }
        );
      }

      if (error.message === "Tournament not found") {
        return NextResponse.json(
          {
            error: "Invalid tournament",
            message: "The specified tournament does not exist"
          },
          { status: 400 }
        );
      }

      // YouTube API or other errors
      return NextResponse.json(
        {
          error: "Match creation failed",
          message: error.message
        },
        { status: 500 }
      );
    }

    // Unknown error
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}
