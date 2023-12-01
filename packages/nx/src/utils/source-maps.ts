import { join } from 'path';
import { projectGraphCacheDirectory } from './cache-directory';
import { readJsonFile, writeJsonFile } from './fileutils';
import { ConfigurationSourceMaps } from '../project-graph/utils/project-configuration-utils';
import { createProjectGraphAsync } from '../project-graph/project-graph';

export function writeSourceMapsToDisk(sourceMaps: ConfigurationSourceMaps) {
  writeJsonFile(
    join(projectGraphCacheDirectory, 'configuration-source-maps.json'),
    sourceMaps
  );
}

export function readSourceMapsFromDisk(): ConfigurationSourceMaps {
  return readJsonFile(
    join(projectGraphCacheDirectory, 'configuration-source-maps.json')
  );
}

export async function getSourceMaps(): Promise<ConfigurationSourceMaps> {
  await createProjectGraphAsync({ exitOnError: true });
  return readSourceMapsFromDisk();
}
