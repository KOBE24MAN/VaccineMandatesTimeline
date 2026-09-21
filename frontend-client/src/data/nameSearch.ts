function normalize(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

/** Partial policy names, reordered words and small spelling errors. */
export function nameMatchScore(name: string, query: string): number {
  const title = normalize(name), normalized = normalize(query);
  if (!normalized || normalized.length > 200) return Infinity;
  if (title.includes(normalized)) return 0;
  const words = title.split(" ");
  let score = 0;
  for (const term of normalized.split(" ")) {
    if (words.some(word => word.includes(term))) continue;
    if (term.length < 4) return Infinity;
    const tolerance = term.length >= 8 ? 2 : 1;
    const candidates = words.filter(word => Math.abs(word.length - term.length) <= tolerance);
    const closest = Math.min(...candidates.map(word => distance(term, word)));
    if (closest > tolerance) return Infinity;
    score += closest;
  }
  return score;
}
