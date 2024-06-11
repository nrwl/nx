import { join } from 'node:path';

import {
  NrwlJsPluginConfig,
  NxJsonConfiguration,
} from '../../../config/nx-json';
import { fileExists, readJsonFile } from '../../../utils/fileutils';
import { PackageJson } from '../../../utils/package-json';
import { workspaceRoot } from '../../../utils/workspace-root';
import { existsSync } from 'fs';

export function jsPluginConfig(
  nxJson: NxJsonConfiguration
): Required<NrwlJsPluginConfig> {
  const nxJsonConfig: NrwlJsPluginConfig =
    nxJson?.pluginsConfig?.['@nx/js'] ?? nxJson?.pluginsConfig?.['@nrwl/js'];

  // using lerna _before_ installing deps is causing an issue when parsing lockfile.
  // See: https://github.com/lerna/lerna/issues/3807
  // Note that previous attempt to fix this caused issues with Nx itself, thus we're checking
  // for Lerna explicitly.
  // See: https://github.com/nrwl/nx/pull/18784/commits/5416138e1ddc1945d5b289672dfb468e8c544e14
  const analyzeLockfile =
    !existsSync(join(workspaceRoot, 'lerna.json')) ||
    existsSync(join(workspaceRoot, 'nx.json'));

  if (nxJsonConfig) {
    return {
      analyzePackageJson: true,
      analyzeSourceFiles: true,
      analyzeLockfile,
      projectsAffectedByDependencyUpdates: 'all',
      ...nxJsonConfig,
    };
  }

  if (!fileExists(join(workspaceRoot, 'package.json'))) {
    return {
      analyzeLockfile: false,
      analyzePackageJson: false,
      analyzeSourceFiles: false,
      projectsAffectedByDependencyUpdates: 'all',
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
    return {
      analyzePackageJson: true,
      analyzeLockfile,
      analyzeSourceFiles: true,
      projectsAffectedByDependencyUpdates: 'all',
    };
  } else {
    return {
      analyzePackageJson: true,
      analyzeLockfile,
      analyzeSourceFiles: false,
      projectsAffectedByDependencyUpdates: 'all',
    };
  }
}
