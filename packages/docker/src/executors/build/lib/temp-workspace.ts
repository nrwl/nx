import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Creates a scratch directory used for the build's lifetime: secret files, buildx's
 * `--iidfile`/`--metadata-file` outputs, and an ad-hoc buildx builder's bookkeeping.
 */
export function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'nx-docker-build-'));
}

export function cleanupTempWorkspace(tempDir: string): void {
  if (tempDir.length > 0) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
