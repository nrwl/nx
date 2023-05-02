import type { Tree } from 'nx/src/generators/tree';
import type { PackageJson } from 'nx/src/utils/package-json';
import { requireNx } from '../../nx';
import { visitNotIgnoredFiles } from '../generators/visit-not-ignored-files';
import { basename } from 'path';
import { isBinaryPath } from './binary-extensions';

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

    const contents = tree.read(path).toString();

    if (!contents.includes(oldPackageName)) {
      return;
    }

    tree.write(
      path,
      contents.replace(new RegExp(oldPackageName, 'g'), newPackageName)
    );
  });
}
