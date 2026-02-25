/** SVG path data for the chain-link icon used in anchor links (matches Starlight heading links). */
export const LINK_ICON_PATH =
  'm12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z';

export const TABLE_HEADERS_TO_MATCH = [
  'option',
  'options',
  'properties',
  'property',
];
/**
 * Converts an option name to an anchor slug.
 *
 * Strips leading `--` or `-` prefixes, takes only the first (canonical) name
 * if aliases are present (comma-separated), lowercases, and replaces
 * non-alphanumeric characters with `-`.
 *
 * Examples:
 *   `--distribute-on` → `distribute-on`
 *   `nxCloudUrl`      → `nxcloudurl`
 *   `--output, -o`    → `output`
 */
export function optionSlug(raw: string): string {
  // Take only the first name if comma-separated aliases exist
  let name = raw.split(',')[0].trim();
  // Strip leading dashes
  name = name.replace(/^-{1,2}/, '');
  // Lowercase and replace non-alphanumeric with hyphens
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
