/**
 * Whether `request` resolves from `directory`, without loading it.
 */
export function canResolve(request: string, directory: string): boolean {
  try {
    require.resolve(request, { paths: [directory] });
    return true;
  } catch {
    return false;
  }
}
