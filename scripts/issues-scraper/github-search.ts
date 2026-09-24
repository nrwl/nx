const SEARCH_URL = {
  issues: 'https://github.com/nrwl/nx/issues',
  pulls: 'https://github.com/nrwl/nx/pulls',
};

export type SearchPath = keyof typeof SEARCH_URL;

// `+` and `:` are both legal unescaped in a query string, and GitHub search URLs
// are long enough that percent-encoding them costs real payload budget.
export function searchUrl(path: SearchPath, qualifiers: string[]): string {
  const q = encodeURIComponent(qualifiers.join(' '))
    .replace(/%20/g, '+')
    .replace(/%3A/g, ':');
  return `${SEARCH_URL[path]}?q=${q}`;
}

export function toSearchDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
