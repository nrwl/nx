import type { Tree } from 'nx/src/generators/tree';
import type { PackageJson } from 'nx/src/utils/package-json';
import { requireNx } from '../../nx';
import { visitNotIgnoredFiles } from '../generators/visit-not-ignored-files';
import { basename } from 'path';
import { isBinaryPath } from './binary-extensions';
const { logger } = requireNx();

const {
  getProjects,
  updateProjectConfiguration,
  readNxJson,
  updateNxJson,
  updateJson,
} = requireNx();

export function replaceNrwlPackageWithNxPackage(
  tree: Tree,
  oldPackageName: string,
  newPackageName: string
): void {
  replacePackageInDependencies(tree, oldPackageName, newPackageName);

  replacePackageInProjectConfigurations(tree, oldPackageName, newPackageName);

  replacePackageInNxJson(tree, oldPackageName, newPackageName);

  replaceMentions(tree, oldPackageName, newPackageName);
}

function replacePackageInDependencies(
  tree: Tree,
  oldPackageName: string,
  newPackageName: string
) {
  visitNotIgnoredFiles(tree, '.', (path) => {
    if (basename(path) !== 'package.json') {
      return;
    }

    try {
      updateJson<PackageJson>(tree, path, (packageJson) => {
        for (const deps of [
          packageJson.dependencies ?? {},
          packageJson.devDependencies ?? {},
          packageJson.peerDependencies ?? {},
          packageJson.optionalDependencies ?? {},
        ]) {
          if (oldPackageName in deps) {
            deps[newPackageName] = deps[oldPackageName];
            delete deps[oldPackageName];
          }
        }
        return packageJson;
      });
    } catch (e) {
      console.warn(
        `Could not replace ${oldPackageName} with ${newPackageName} in ${path}.`
      );
    }
  });
}

function replacePackageInProjectConfigurations(
  tree: Tree,
  oldPackageName: string,
  newPackageName: string
) {
  const projects = getProjects(tree);

  for (const [projectName, projectConfiguration] of projects) {
    let needsUpdate = false;

    for (const [targetName, targetConfig] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      if (!targetConfig.executor) {
        continue;
      }

      const [pkg, executorName] = targetConfig.executor.split(':');
      if (pkg === oldPackageName) {
        needsUpdate = true;

        projectConfiguration.targets[targetName].executor =
          newPackageName + ':' + executorName;
      }
    }

    for (const [collection, collectionDefaults] of Object.entries(
      projectConfiguration.generators ?? {}
    )) {
      if (collection === oldPackageName) {
        needsUpdate = true;

        projectConfiguration.generators[newPackageName] = collectionDefaults;
        delete projectConfiguration.generators[collection];
      }
    }

    if (needsUpdate) {
      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  }
}

function replacePackageInNxJson(
  tree: Tree,
  oldPackageName: string,
  newPackageName: string
) {
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson = readNxJson(tree);

  let needsUpdate = false;

  for (const [targetName, targetConfig] of Object.entries(
    nxJson.targetDefaults ?? {}
  )) {
    if (!targetConfig.executor) {
      continue;
    }

    const [pkg, executorName] = targetConfig.executor.split(':');
    if (pkg === oldPackageName) {
      needsUpdate = true;

      nxJson.targetDefaults[targetName].executor =
        newPackageName + ':' + executorName;
    }
  }

  for (const [collection, collectionDefaults] of Object.entries(
    nxJson.generators ?? {}
  )) {
    if (collection === oldPackageName) {
      needsUpdate = true;

      nxJson.generators[newPackageName] = collectionDefaults;
      delete nxJson.generators[collection];
    }
  }

  if (needsUpdate) {
    updateNxJson(tree, nxJson);
  }
}

function replaceMentions(
  tree: Tree,
  oldPackageName: string,
  newPackageName: string
) {
  visitNotIgnoredFiles(tree, '.', (path) => {
    if (isBinaryPath(path)) {
      return;
    }

    const ignoredFiles = [
      'yarn.lock',
      'package-lock.json',
      'pnpm-lock.yaml',
      'CHANGELOG.md',
    ];
    if (ignoredFiles.includes(basename(path))) {
      return;
    }

    try {
      const contents = tree.read(path).toString();

      if (!contents.includes(oldPackageName)) {
        return;
      }

      tree.write(
        path,
        contents.replace(new RegExp(oldPackageName, 'g'), newPackageName)
      );
    } catch {
      // Its **probably** ok, contents can be null if the file is too large or
      // there was an access exception.
      logger.warn(
        `An error was thrown when trying to update ${path}. If you believe the migration should have updated it, be sure to review the file and open an issue.`
      );
    }
  });
}
