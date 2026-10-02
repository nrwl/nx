import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const localRequire = createRequire(import.meta.url);

/**
 * Absolute path of Oxlint's CLI entry as installed in the workspace, or null
 * when `oxlint` cannot be resolved from there. Spawn it through
 * `process.execPath` so nothing depends on a shell or on PATH.
 */
export function resolveOxlintBin(workspaceRoot: string): string | null {
  try {
    const bin = join(
      dirname(
        localRequire.resolve('oxlint/package.json', { paths: [workspaceRoot] })
      ),
      'bin',
      'oxlint'
    );
    return existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}
