function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function hash6(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = (((h << 5) + h) ^ text.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

export function makeStableId(programName: string, dateISO?: string, geo?: string): string {
  const base = [programName, dateISO, geo].filter(Boolean).join("|") || programName || "session";
  const slug = slugify(base) || "session";
  return `${slug}-${hash6(base)}`;
}
