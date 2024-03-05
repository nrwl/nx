import { output, ProjectConfiguration, readJson, type Tree } from '@nx/devkit';

const startLocalRegistryScript = (localRegistryTarget: string) => `
/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { execFileSync } from 'child_process';
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
    generatorOptionsOverrides: {
      skipLockFileUpdate: true
    }
  });
  await releasePublish({
    tag: 'e2e',
    firstRelease: true
  });
};
`;

const stopLocalRegistryScript = `
/**
 * This script stops the local registry for e2e testing purposes.
 * It is meant to be called in jest's globalTeardown.
 */

export default () => {
  if (global.stopLocalRegistry) {
    global.stopLocalRegistry();
  }
};
`;

export function addLocalRegistryScripts(tree: Tree) {
  const startLocalRegistryPath = 'tools/scripts/start-local-registry.ts';
  const stopLocalRegistryPath = 'tools/scripts/stop-local-registry.ts';

  const projectConfiguration: ProjectConfiguration = readJson(
    tree,
    'project.json'
  );

  const localRegistryTarget = `${projectConfiguration.name}:local-registry`;
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

  return { startLocalRegistryPath, stopLocalRegistryPath };
}
