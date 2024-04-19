export function selectSourceInfo(
  sourceMap: Record<string, Array<string>>,
  path: string
): Array<string> | null {
  let rootKey: string | undefined;
  let rootSource: Array<string> | undefined;
  for (const [key, value] of Object.entries(sourceMap)) {
    if (path === key) {
      return value;
    } else if (path.startsWith(`${key}.`)) {
      // When the key is a prefix of the filter, we can record it as the root source.
      // Use the most specific key for the root "." source value.
      // e.g. `targets.build` takes precedence over `targets`
      if (!rootKey || key?.startsWith(rootKey)) {
        rootKey = key;
        rootSource = value;
      }
    }
  }
  return rootSource || null;
}
