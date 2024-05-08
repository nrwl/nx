export function stringifyCollection(items: string[]): string {
  return items.map((item) => `"${item}"`).join(', ');
}
