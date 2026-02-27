import { join } from 'path';
import { MavenAnalysisData } from './types';
import {
  PluginCache,
  readPluginCache,
  safeWritePluginCache,
} from 'nx/src/utils/plugin-cache-utils';

/**
 * Read the Maven targets cache from disk
 */
export function readMavenCache(
  cachePath: string
): PluginCache<MavenAnalysisData> {
  return readPluginCache<MavenAnalysisData>(cachePath);
}

/**
 * Write the Maven targets cache to disk
 */
export function writeMavenCache(
  cachePath: string,
  cache: PluginCache<MavenAnalysisData>
): void {
  safeWritePluginCache(cachePath, cache);
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
