/**
 * Takes in a percentage like 0.33 and rounds to the nearest 0, 25%, 50%, 75%, 90% bucket.
 */
export function getScrollDepth(pct: number): 0 | 25 | 50 | 75 | 90 {
  // Anything greater than 0.9 is just 90% and counts as reaching the bottom.
  if (pct >= 0.9) {
    return 90;
  }

  // Otherwise, divide into quarters (0, 25, 50, 75).
  if (pct < 0.25) return 0;
  if (pct < 0.5) return 25;
  if (pct < 0.75) return 50;
  return 75;
}
