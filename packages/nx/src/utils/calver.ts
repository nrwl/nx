/**
 * Comparison for dotted calver tags (e.g. `2510.28.15`). Segments are
 * compared numerically so `2510.28.15` sorts above `2510.28.5`, which a
 * lexical comparison would invert. Non-numeric segments fall back to lexical
 * ordering so unexpected formats still order deterministically, and a missing
 * segment sorts below a present one (`2510.28` < `2510.28.1`).
 */
export function compareCalver(a: string, b: string): number {
  const aSegments = a.split('.');
  const bSegments = b.split('.');
  const length = Math.max(aSegments.length, bSegments.length);
  for (let i = 0; i < length; i++) {
    const aSegment = aSegments[i] ?? '';
    const bSegment = bSegments[i] ?? '';
    if (aSegment === bSegment) {
      continue;
    }
    const aNumber = Number(aSegment);
    const bNumber = Number(bSegment);
    if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
      return aNumber - bNumber;
    }
    return aSegment < bSegment ? -1 : 1;
  }
  return 0;
}

export function gt(a: string, b: string): boolean {
  return compareCalver(a, b) > 0;
}

export function gte(a: string, b: string): boolean {
  return compareCalver(a, b) >= 0;
}

export function lt(a: string, b: string): boolean {
  return compareCalver(a, b) < 0;
}

export function lte(a: string, b: string): boolean {
  return compareCalver(a, b) <= 0;
}

export function eq(a: string, b: string): boolean {
  return compareCalver(a, b) === 0;
}
