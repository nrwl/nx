export function getSourceInformation(
  sourceMap: Record<string, string[]>,
  key: string
): string | undefined {
  const sourceInfo = sourceMap?.[key];
  if (sourceInfo) {
    return `${key} was set by plugin \n \n ${sourceInfo[1]} \n \n while processing \n \n ${sourceInfo[0]}`;
  }
  if (!key.includes('.')) {
    return undefined;
  }
  return getSourceInformation(
    sourceMap,
    key.substring(0, key.lastIndexOf('.'))
  );
}
