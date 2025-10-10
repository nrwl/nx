import { ProjectConfiguration, readJsonFile, writeJsonFile } from '@nx/devkit';
import { existsSync } from 'fs';

export type DotNetTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

export function readTargetsCache(
  cachePath: string
): Record<string, DotNetTargets> {
  return process.env.NX_CACHE_PROJECT_GRAPH !== 'false' && existsSync(cachePath)
    ? readJsonFile(cachePath)
    : {};
}

export function writeTargetsToCache(
  cachePath: string,
  results: Record<string, DotNetTargets>
) {
  writeJsonFile(cachePath, results);
}
