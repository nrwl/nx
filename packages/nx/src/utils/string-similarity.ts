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
 * The number of edits tolerated before `candidate` stops being a useful
 * suggestion for `input`.
 *
 * The tolerance scales with length so longer words allow for more typos, but it
 * scales with the length of the part that actually *differs* — the shared
 * prefix and suffix are stripped first. Scaling on the raw length lets text the
 * user typed correctly buy a bigger budget for the part they got wrong, which
 * matters because these inputs are joined `project:target[:configuration]`
 * specifiers: `zzz:build` and `api:build` are 3 edits apart, but the shared
 * `:build` inflates the raw-length budget to 4 and a project name with no
 * character in common gets suggested.
 *
 * Stripping a common prefix and suffix does not change the Levenshtein
 * distance, so a caller's precomputed `distance` remains directly comparable.
 */
function suggestionThreshold(input: string, candidate: string): number {
  const shortest = Math.min(input.length, candidate.length);
  let prefix = 0;
  while (prefix < shortest && input[prefix] === candidate[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    input[input.length - 1 - suffix] ===
      candidate[candidate.length - 1 - suffix]
  ) {
    suffix++;
  }
  return Math.max(2, Math.ceil((input.length - prefix - suffix) * 0.4));
}

/**
 * Whether a candidate at edit `distance` from `input` is close enough to be a
 * useful suggestion. Exposed so callers that already have a distance (e.g. from
 * `rankByDistance`) can gate on it without recomputing.
 */
export function isWithinSuggestionThreshold(
  input: string,
  candidate: string,
  distance: number
): boolean {
  return distance <= suggestionThreshold(input, candidate);
}

/**
 * Ranks the candidates that are similar enough to `input` to be worth
 * suggesting, closest first (ties broken alphabetically). Each entry keeps its
 * distance so callers can compare suggestions found for different forms of the
 * same input without recomputing.
 */
export function rankSuggestions(
  input: string,
  candidates: readonly string[]
): { candidate: string; distance: number }[] {
  return rankByDistance(input, candidates).filter(({ candidate, distance }) =>
    isWithinSuggestionThreshold(input, candidate, distance)
  );
}

/**
 * Returns up to `limit` candidates that most closely resemble `input`, sorted
 * from closest to furthest. Candidates that are not similar enough to be a
 * useful suggestion are excluded.
 */
export function findClosestMatches(
  input: string,
  candidates: readonly string[],
  limit = 3
): string[] {
  return rankSuggestions(input, candidates)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
