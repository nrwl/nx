import { type NxJsonConfiguration, writeJsonFile } from '@nx/devkit';
import { randomUUID } from 'node:crypto';
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function updateNxJson(
  nxJsonPath: string,
  updater: (json: NxJsonConfiguration) => NxJsonConfiguration
): void {
  const json = JSON.parse(readFileSync(nxJsonPath, 'utf8'));
  // A scan during the update must not discover the staged configuration.
  const temporaryFile = join(
    dirname(nxJsonPath),
    '.nx',
    'workspace-data',
    `nx.json-${randomUUID()}`
  );

  try {
    writeJsonFile(temporaryFile, updater(json));
    renameSync(temporaryFile, nxJsonPath);
  } finally {
    try {
      rmSync(temporaryFile, { force: true });
    } catch {}
  }
}
