import { ProjectGraphProcessor } from '../../config/project-graph';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';
import { buildNpmPackageNodes } from './project-graph/build-nodes/build-npm-package-nodes';
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
import { removeNpmNodes } from 'nx/src/plugins/js/lock-file/remove-npm-nodes';

export const processProjectGraph: ProjectGraphProcessor = async (
  graph,
  context
) => {
  const builder = new ProjectGraphBuilder(graph);

  const lockHash = lockFileHash() ?? 'n/a';
  // during the create-nx-workspace lock file might not exists yet
  if (lockFileExists()) {
    if (lockFileNeedsReprocessing(lockHash)) {
      removeNpmNodes(graph, builder);
      parseLockFile(builder);
    }
    writeLastProcessedLockfileHash(lockHash);
  }

  buildNpmPackageNodes(builder);

  await buildExplicitDependencies(
    jsPluginConfig(readNxJson()),
    context,
    builder
  );

  return builder.getUpdatedProjectGraph();
};

const lockFileHashFile = join(projectGraphCacheDirectory, 'lockfile.hash');
function lockFileNeedsReprocessing(lockHash: string) {
  try {
    return readFileSync(lockFileHashFile).toString() !== lockHash;
  } catch {
    return true;
  }
}

function writeLastProcessedLockfileHash(hash: string) {
  ensureDirSync(dirname(lockFileHashFile));
  writeFileSync(lockFileHashFile, hash);
}

function jsPluginConfig(nxJson: NxJsonConfiguration): NrwlJsPluginConfig {
  if (nxJson?.pluginsConfig?.['@nrwl/js']) {
    return nxJson?.pluginsConfig?.['@nrwl/js'];
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
