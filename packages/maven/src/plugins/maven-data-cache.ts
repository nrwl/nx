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
export function getCachedMavenData(workspaceRoot: string): MavenAnalysisData | null {
  // Check both possible locations for the analysis file
  const analysisFile = join(workspaceDataDirectory, 'nx-maven-projects.json');
  const fallbackAnalysisFile = join(workspaceRoot, 'nx-maven-projects.json');
  
  let actualAnalysisFile = analysisFile;
  if (!existsSync(analysisFile)) {
    if (existsSync(fallbackAnalysisFile)) {
      actualAnalysisFile = fallbackAnalysisFile;
    } else {
      return null;
    }
  }

  try {
    const fileStats = statSync(actualAnalysisFile);
    const lastModified = fileStats.mtime.getTime();

    // Check if we have cached data and if it's still fresh
    if (cachedData && 
        cachedData.filePath === actualAnalysisFile && 
        cachedData.lastModified === lastModified) {
      return cachedData.data;
    }

    // Read and cache the data
    const fileContent = readFileSync(actualAnalysisFile, 'utf8');
    const data = JSON.parse(fileContent) as MavenAnalysisData;

    cachedData = {
      data,
      lastModified,
      filePath: actualAnalysisFile
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