export function parseBatchSize(input?: string | number | null): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  const match = String(input).match(/\d+/);
  if (!match) return null;
  const n = parseInt(match[0], 10);
  return Number.isNaN(n) ? null : n;
}
