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
  const threshold = Math.max(2, Math.ceil(input.length * 0.4));
  return candidates
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(input, candidate),
    }))
    .filter(({ distance }) => distance <= threshold)
    .sort((a, b) => a.distance - b.distance)
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
