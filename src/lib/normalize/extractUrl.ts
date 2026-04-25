export function extractUrl(input?: string | null): string | null {
  if (!input) return null;
  const text = String(input);
  const match = text.match(/https?:\/\/[^\s"'<>()[\]]+/i);
  return match ? match[0].replace(/[.,;)\]]+$/, "") : null;
}
