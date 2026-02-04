import { z } from "zod";

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

  return Response.json({ matches: [] });
}
