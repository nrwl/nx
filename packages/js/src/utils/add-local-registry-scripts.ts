import { ProjectConfiguration, readJson, type Tree } from '@nx/devkit';

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

  const nx = require.resolve('nx');
  execFileSync(
    nx,
    ['run-many', '--targets', 'build'],
    { env: process.env, stdio: 'inherit' }
  )

  await releaseVersion({
    specifier: '0.0.0-e2e',
    stageChanges: false,
    gitCommit: false,
    gitTag: false,
    generatorOptionsOverrides: {
      skipLockFileUpdate: true
    }
  });
  await releasePublish({
    tag: 'e2e'
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
  }
  if (!tree.exists(stopLocalRegistryPath)) {
    tree.write(stopLocalRegistryPath, stopLocalRegistryScript);
  }

  return { startLocalRegistryPath, stopLocalRegistryPath };
}
