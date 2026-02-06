import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getPoolStatus } from "@/lib/stream-pool";

/**
 * Get stream pool status
 * GET /api/admin/stream-pool/status
 */
export async function GET() {
  // Validate admin session
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getPoolStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error("Failed to get pool status:", error);

    return NextResponse.json(
      {
        error: "Failed to get pool status",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
