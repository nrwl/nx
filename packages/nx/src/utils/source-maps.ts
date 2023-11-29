import { join } from 'path';
import { projectGraphCacheDirectory } from './cache-directory';
import { readJsonFile, writeJsonFile } from './fileutils';
import { ConfigurationSourceMaps } from '../project-graph/utils/project-configuration-utils';

export function writeSourceMaps(sourceMaps: ConfigurationSourceMaps) {
  writeJsonFile(
    join(projectGraphCacheDirectory, 'configuration-source-maps.json'),
    sourceMaps
  );
}

export function readSourceMaps(): ConfigurationSourceMaps {
  return readJsonFile(
    join(projectGraphCacheDirectory, 'configuration-source-maps.json')
  );
}
