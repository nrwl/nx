import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Creates a unique directory under the OS temp dir and returns its path. This
 * is a thin replacement for the `tmp` package's `dirSync().name`; cleanup is
 * the caller's responsibility (matching the previous behavior).
 */
export function createTempDir(prefix = 'nx-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}
