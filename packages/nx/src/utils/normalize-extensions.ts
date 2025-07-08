/**
 * Normalize user input for extensions
 * - trim
 * - strip leading . characters
 * - convert to lower case
 * - unique
 *
 * Returns undefined for non-arrays, returns empty array as is.
 */

export function normalizeExtensions(
  extensions: string[] | undefined
): string[] | undefined {
  if (!Array.isArray(extensions)) return undefined;
  if (extensions.length === 0) return extensions;
  const normalized = extensions
    .map((f: string) =>
      f.trim().replace(/^"+/, '').replace(/^[.]+/, '').toLowerCase()
    )
    .filter((f) => f.length > 0);
  return Array.from(new Set(normalized));
}
