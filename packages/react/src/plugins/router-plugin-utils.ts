export function resolveOptionalModule(
  request: string,
  directory: string
): string | null {
  try {
    return require.resolve(request, { paths: [directory] });
  } catch {
    return null;
  }
}
