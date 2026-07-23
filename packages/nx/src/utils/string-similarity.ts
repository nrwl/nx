/**
 * Computes the Levenshtein edit distance between two strings, i.e. the minimum
 * number of single-character insertions, deletions, or substitutions required
 * to turn `a` into `b`.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  let currentRow = new Array<number>(b.length + 1);

  for (let i = 0; i < a.length; i++) {
    currentRow[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      currentRow[j + 1] = Math.min(
        currentRow[j] + 1, // insertion
        previousRow[j + 1] + 1, // deletion
        previousRow[j] + cost // substitution
      );
    }
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[b.length];
}

/**
 * Ranks every candidate by how closely it resembles `input`, from closest to
 * furthest, tie-broken alphabetically so the order is deterministic. Each entry
 * keeps its computed distance so callers can reuse it (e.g. to both pick the
 * closest match and order a list) without recomputing.
 */
export function rankByDistance(
  input: string,
  candidates: readonly string[]
): { candidate: string; distance: number }[] {
  return candidates
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(input, candidate),
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance || a.candidate.localeCompare(b.candidate)
    );
}

/**
 * Whether a candidate at edit `distance` from `input` is close enough to be a
 * useful suggestion. The tolerance scales with the length of `input` so that
 * longer words allow for more typos. Exposed so callers that already have a
 * distance (e.g. from `rankByDistance`) can gate on it without recomputing.
 */
export function isWithinSuggestionThreshold(
  input: string,
  distance: number
): boolean {
  return distance <= Math.max(2, Math.ceil(input.length * 0.4));
}

/**
 * Returns up to `limit` candidates that most closely resemble `input`, sorted
 * from closest to furthest. Candidates that are not similar enough to be a
 * useful suggestion are excluded. The tolerance scales with the length of
 * `input` so that longer words allow for more typos.
 */
export function findClosestMatches(
  input: string,
  candidates: readonly string[],
  limit = 3
): string[] {
  return rankByDistance(input, candidates)
    .filter(({ distance }) => isWithinSuggestionThreshold(input, distance))
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/**
 * Returns the candidate that most closely resembles `input`, or `undefined`
 * when no candidate is similar enough to be a useful suggestion.
 */
export function findClosestMatch(
  input: string,
  candidates: readonly string[]
): string | undefined {
  return findClosestMatches(input, candidates, 1)[0];
}
