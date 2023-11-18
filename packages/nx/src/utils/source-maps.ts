import { join } from 'path';
import { projectGraphCacheDirectory } from './cache-directory';
import { writeJsonFile } from './fileutils';

export function writeSourceMaps(
  sourceMaps: Record<string, Record<string, string[]>>
) {
  writeJsonFile(
    join(projectGraphCacheDirectory, 'configuration-source-maps.json'),
    sourceMaps
  );
}
