import { output, ProjectConfiguration, readJson, type Tree } from '@nx/devkit';
import type { PackageJson } from 'nx/src/utils/package-json';

const startLocalRegistryScript = (localRegistryTarget: string) => `/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */

/// <reference path="registry.d.ts" />

import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '${localRegistryTarget}';
  // storage folder for the local registry
  const storage = './tmp/local-registry/storage';

  global.stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget,
    storage,
    verbose: false,
  });

  await releaseVersion({
    specifier: '0.0.0-e2e',
    stageChanges: false,
    gitCommit: false,
    gitTag: false,
    firstRelease: true,
    versionActionsOptionsOverrides: {
      skipLockFileUpdate: true
    }
  });
  await releasePublish({
    tag: 'e2e',
    firstRelease: true
  });
};
`;

const stopLocalRegistryScript = `/**
 * This script stops the local registry for e2e testing purposes.
 * It is meant to be called in jest's globalTeardown.
 */

/// <reference path="registry.d.ts" />

export default () => {
  if (global.stopLocalRegistry) {
    global.stopLocalRegistry();
  }
};
`;

const registryDeclarationText = `declare function stopLocalRegistry(): void;
`;

export function addLocalRegistryScripts(tree: Tree) {
  const startLocalRegistryPath = 'tools/scripts/start-local-registry.ts';
  const stopLocalRegistryPath = 'tools/scripts/stop-local-registry.ts';
  const registryDeclarationPath = 'tools/scripts/registry.d.ts';

  let projectName: string;
  try {
    ({ name: projectName } = readJson<ProjectConfiguration>(
      tree,
      'project.json'
    ));
  } catch {
    // if project.json doesn't exist, try package.json
    const { name, nx } = readJson<PackageJson>(tree, 'package.json');
    projectName = nx?.name ?? name;
  }

  const localRegistryTarget = `${projectName}:local-registry`;
  if (!tree.exists(startLocalRegistryPath)) {
    tree.write(
      startLocalRegistryPath,
      startLocalRegistryScript(localRegistryTarget)
    );
  } else {
    const existingStartLocalRegistryScript = tree
      .read(startLocalRegistryPath)
      .toString();
    if (!existingStartLocalRegistryScript.includes('nx/release')) {
      output.warn({
        title:
          'Your `start-local-registry.ts` script may be outdated. To ensure that newly generated packages are published appropriately when running end to end tests, update this script to use Nx Release. See https://nx.dev/recipes/nx-release/update-local-registry-setup for details.',
      });
    }
  }
  if (!tree.exists(stopLocalRegistryPath)) {
    tree.write(stopLocalRegistryPath, stopLocalRegistryScript);
  }
  if (!tree.exists(registryDeclarationPath)) {
    tree.write(registryDeclarationPath, registryDeclarationText);
  }

  return { startLocalRegistryPath, stopLocalRegistryPath };
}
