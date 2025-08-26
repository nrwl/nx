import { join } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { MavenAnalysisData } from './types';

interface CacheEntry {
  data: MavenAnalysisData;
  lastModified: number;
  filePath: string;
}

// In-memory cache for Maven analysis data
let cachedData: CacheEntry | null = null;

/**
 * Get cached Maven analysis data or read from file if cache is stale
 */
export function getCachedMavenData(workspaceRoot: string, skipCache = false): MavenAnalysisData | null {
  // Skip cache if requested (e.g., in verbose mode)
  if (skipCache) {
    return null;
  }
  const analysisFile = join(workspaceRoot, '.nx', 'workspace-data', 'nx-maven-projects.json');
  
  if (!existsSync(analysisFile)) {
    console.log('[Maven Cache] Analysis file not found:', analysisFile);
    return null;
  }
  
  console.log('[Maven Cache] Found analysis file:', analysisFile);

  try {
    const fileStats = statSync(analysisFile);
    const lastModified = fileStats.mtime.getTime();

    // Check if we have cached data and if it's still fresh
    if (cachedData && 
        cachedData.filePath === analysisFile && 
        cachedData.lastModified === lastModified) {
      return cachedData.data;
    }

    // Read and cache the data
    const fileContent = readFileSync(analysisFile, 'utf8');
    const data = JSON.parse(fileContent) as MavenAnalysisData;

    cachedData = {
      data,
      lastModified,
      filePath: analysisFile
    };

    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Clear the cache (useful for testing)
 */
export function clearMavenDataCache(): void {
  cachedData = null;
}