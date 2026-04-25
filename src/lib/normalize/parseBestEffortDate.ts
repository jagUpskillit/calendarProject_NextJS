const MONTHS: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

/**
 * Best-effort date extraction from schedule text, fixed year context 2026.
 * Handles: "21 - Apr", "7-May", "19th May", "June", "TBD".
 */
export function parseBestEffortDate(input?: string | null, year = 2026): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  if (!s) return undefined;

  if (/\b(tbd|to be decided|to be announced)\b/i.test(s)) return undefined;

  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dayMonth = s.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s*[-/]?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );
  if (dayMonth) {
    const day = dayMonth[1].padStart(2, "0");
    const key = dayMonth[2].toLowerCase();
    const month = MONTHS[key];
    if (month) return `${year}-${month}-${day}`;
  }

  const monthOnly = s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
  if (monthOnly) {
    return undefined;
  }

  return undefined;
}
