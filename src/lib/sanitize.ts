/**
 * Strip HTML tags from a string to prevent XSS in stored content.
 * Applied after Zod validation, before database writes and YouTube API calls.
 */
export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}
