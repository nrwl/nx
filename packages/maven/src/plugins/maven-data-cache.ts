import { join } from 'path';
import { readJsonFile, writeJsonFile } from '@nx/devkit';
import { MavenAnalysisData } from './types';

/**
 * Read the Maven targets cache from disk
 */
export function readMavenCache(
  cachePath: string
): Record<string, MavenAnalysisData> {
  try {
    return process.env.NX_CACHE_PROJECT_GRAPH !== 'false'
      ? readJsonFile(cachePath)
      : {};
  } catch {
    return {};
  }
}

/**
 * Write the Maven targets cache to disk
 */
export function writeMavenCache(
  cachePath: string,
  cache: Record<string, MavenAnalysisData>
): void {
  writeJsonFile(cachePath, cache);
}

/**
 * Get the cache path for a given options hash
 */
export function getCachePath(
  workspaceRoot: string,
  optionsHash: string
): string {
  return join(
    workspaceRoot,
    '.nx',
    'workspace-data',
    `maven-${optionsHash}.hash`
  );
}

/**
 * Module-level variable to pass Maven analysis data from createNodes to createDependencies
 * without relying on hash matching (which can differ when projects use <includes>/<excludes>).
 */
let currentMavenData: MavenAnalysisData | null = null;

export function setCurrentMavenData(data: MavenAnalysisData): void {
  currentMavenData = data;
}

export function getCurrentMavenData(): MavenAnalysisData | null {
  return currentMavenData;
}
