// Loaded on first use; a top-level import breaks unit tests in the Nx repo.
// Cached because each `require` call re-resolves the module.
let native: typeof import('../native') | undefined;
function getNative(): typeof import('../native') {
  return (native ??= require('../native'));
}

export function hashArray(content: string[]): string {
  return getNative().hashArray(content);
}

export function hashObject(obj: object): string {
  const parts: string[] = [];

  for (const key of Object.keys(obj ?? {}).sort()) {
    parts.push(key);
    parts.push(JSON.stringify(obj[key]));
  }

  return getNative().hashArray(parts);
}

export function hashFile(filePath: string): string {
  return getNative().hashFile(filePath);
}
