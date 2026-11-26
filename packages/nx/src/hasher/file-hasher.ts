// Loaded on first use; a top-level import breaks unit tests in the Nx repo.
// Cached because each `require` call re-resolves the module.
let native: typeof import('../native') | undefined;
function getNative(): typeof import('../native') {
  return (native ??= require('../native'));
}

export function hashArray(content: Array<string | null | undefined>): string {
  return getNative().hashArray(content);
}

export function hashObject(obj: object | null | undefined): string {
  const parts: string[] = [];

  const entries = Object.entries(obj ?? {}).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  for (const [key, value] of entries) {
    parts.push(key);
    parts.push(JSON.stringify(value));
  }

  return getNative().hashArray(parts);
}

export function hashFile(filePath: string): string | null {
  return getNative().hashFile(filePath);
}
