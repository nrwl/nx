/**
 * 1,000,000 -> 1M
 **/
export const largeNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
}).format;

/**
 * 2025-01-01 -> Jan 1, 2025
 **/
export const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}).format;
