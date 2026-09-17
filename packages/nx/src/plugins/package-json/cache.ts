import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { workspaceDataDirectory } from '../../utils/cache-directory';
import { PluginCache, readPluginCache } from '../../utils/plugin-cache-utils';
import { join } from 'node:path';

export interface CachedPackageJsonProject {
  project: ProjectConfiguration;
  hasNxJsPlugin?: boolean;
  releaseTargetDefaultsHash?: string;
}

export class PackageJsonConfigurationCache {
  private changed = false;
  private readonly usedKeys = new Set<string>();
  private readonly cachedEntries: Record<string, CachedPackageJsonProject>;
  private entryCount: number;

  constructor(private readonly packageJsonCachePath: string) {
    this.cachedEntries =
      readPluginCache<CachedPackageJsonProject>(packageJsonCachePath).entries;
    this.entryCount = Object.keys(this.cachedEntries).length;
  }

  get(key: string): CachedPackageJsonProject | undefined {
    const value = this.cachedEntries[key];
    if (value !== undefined) {
      this.usedKeys.add(key);
    }
    return value;
  }

  set(key: string, value: CachedPackageJsonProject): void {
    this.changed = true;
    this.usedKeys.add(key);
    if (!(key in this.cachedEntries)) {
      this.entryCount++;
    }
    this.cachedEntries[key] = value;
  }

  writeToDiskIfChanged(): void {
    if (!this.changed && this.entryCount === this.usedKeys.size) {
      return;
    }

    for (const key of Object.keys(this.cachedEntries)) {
      if (!this.usedKeys.has(key)) {
        delete this.cachedEntries[key];
      }
    }
    new PluginCache(
      this.packageJsonCachePath,
      this.cachedEntries,
      this.usedKeys
    ).writeToDisk();
    this.changed = false;
    this.entryCount = this.usedKeys.size;
  }
}

export function readPackageJsonConfigurationCache(
  cacheFileName = 'package-json.hash'
): PackageJsonConfigurationCache {
  return new PackageJsonConfigurationCache(
    join(workspaceDataDirectory, cacheFileName)
  );
}
