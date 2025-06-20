/**
 * normalizes options with defaults (e.g. for plugins)
 * populates undefined options with defaults.
 */

// Overload: defaults is Required<T> standard case
export function normalizeOptions<T extends object>(
  options: Partial<T> | undefined,
  defaults: Required<T>
): Required<T>;
// Overload: defaults is Partial<T> eg in cypress plugin
export function normalizeOptions<T extends object>(
  options: Partial<T> | undefined,
  defaults: Partial<T>
): Partial<T>;
// Implementation
export function normalizeOptions<T extends object>(
  options: Partial<T> | undefined = {},
  defaults: Required<T> | Partial<T>
): Required<T> | Partial<T> {
  const normalized = { ...defaults, ...options };
  return normalized;
}
