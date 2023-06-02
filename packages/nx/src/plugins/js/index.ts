import {
  ProjectGraph,
  ProjectGraphProcessor,
} from '../../config/project-graph';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';
import { buildExplicitDependencies } from './project-graph/build-dependencies/build-dependencies';
import { readNxJson } from '../../config/configuration';
import { fileExists, readJsonFile } from '../../utils/fileutils';
import { PackageJson } from '../../utils/package-json';
import {
  lockFileExists,
  lockFileHash,
  parseLockFile,
} from './lock-file/lock-file';
import { NrwlJsPluginConfig, NxJsonConfiguration } from '../../config/nx-json';
import { dirname, join } from 'path';
import { projectGraphCacheDirectory } from '../../utils/cache-directory';
import { readFileSync, writeFileSync } from 'fs';
import { workspaceRoot } from '../../utils/workspace-root';
import { ensureDirSync } from 'fs-extra';

export const processProjectGraph: ProjectGraphProcessor = async (
  graph,
  context
) => {
  const builder = new ProjectGraphBuilder(graph, context.fileMap);
  const pluginConfig = jsPluginConfig(readNxJson());

  if (pluginConfig.analyzePackageJson) {
    // during the create-nx-workspace lock file might not exists yet
    if (lockFileExists()) {
      const lockHash = lockFileHash();
      let parsedLockFile: ProjectGraph;
      if (lockFileNeedsReprocessing(lockHash)) {
        parsedLockFile = parseLockFile();
        writeLastProcessedLockfileHash(lockHash, parsedLockFile);
      } else {
        parsedLockFile = readParsedLockFile();
      }
      builder.mergeProjectGraph(parsedLockFile);
    }
  }

  await buildExplicitDependencies(pluginConfig, context, builder);

  return builder.getUpdatedProjectGraph();
};

const lockFileHashFile = join(projectGraphCacheDirectory, 'lockfile.hash');
const parsedLockFile = join(
  projectGraphCacheDirectory,
  'parsed-lock-file.json'
);

function lockFileNeedsReprocessing(lockHash: string) {
  try {
    return readFileSync(lockFileHashFile).toString() !== lockHash;
  } catch {
    return true;
  }
}

function writeLastProcessedLockfileHash(hash: string, lockFile: ProjectGraph) {
  ensureDirSync(dirname(lockFileHashFile));
  writeFileSync(parsedLockFile, JSON.stringify(lockFile, null, 2));
  writeFileSync(lockFileHashFile, hash);
}

function readParsedLockFile(): ProjectGraph {
  return JSON.parse(readFileSync(parsedLockFile).toString());
}

function jsPluginConfig(
  nxJson: NxJsonConfiguration
): Required<NrwlJsPluginConfig> {
  const nxJsonConfig: NrwlJsPluginConfig =
    nxJson?.pluginsConfig?.['@nx/js'] ?? nxJson?.pluginsConfig?.['@nrwl/js'];

  if (nxJsonConfig) {
    return {
      analyzePackageJson: true,
      analyzeSourceFiles: true,
      ...nxJsonConfig,
    };
  }

  if (!fileExists(join(workspaceRoot, 'package.json'))) {
    return {
      analyzePackageJson: false,
      analyzeSourceFiles: false,
    };
  }

  const packageJson = readJsonFile<PackageJson>(
    join(workspaceRoot, 'package.json')
  );

  const packageJsonDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  if (
    packageJsonDeps['@nx/workspace'] ||
    packageJsonDeps['@nx/js'] ||
    packageJsonDeps['@nx/node'] ||
    packageJsonDeps['@nx/next'] ||
    packageJsonDeps['@nx/react'] ||
    packageJsonDeps['@nx/angular'] ||
    packageJsonDeps['@nx/web'] ||
    packageJsonDeps['@nrwl/workspace'] ||
    packageJsonDeps['@nrwl/js'] ||
    packageJsonDeps['@nrwl/node'] ||
    packageJsonDeps['@nrwl/next'] ||
    packageJsonDeps['@nrwl/react'] ||
    packageJsonDeps['@nrwl/angular'] ||
    packageJsonDeps['@nrwl/web']
  ) {
    return { analyzePackageJson: true, analyzeSourceFiles: true };
  } else {
    return { analyzePackageJson: true, analyzeSourceFiles: false };
  }
}
