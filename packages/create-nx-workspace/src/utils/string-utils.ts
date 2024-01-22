export function stringifyCollection(items: string[]): string {
  return items.map((item) => `"${item}"`).join(', ');
}

export function getFileName(name: string) {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[ _]/g, '-');
}
