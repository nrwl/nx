---
title: Update Your Local Registry Setup to use Nx Release
description: Learn how to update your existing local registry setup to use Nx Release for publishing packages during end-to-end testing, replacing older publish target approaches.
---

# Update Your Local Registry Setup to use Nx Release

Nx will create a `tools/start-local-registry.ts` script for starting a local registry and publishing packages to it in preparation for running end to end tests. If you have an existing `tools/start-local-registry.ts` script from a previous version of Nx, you should update it to use Nx Release to publish packages to the local registry. This will ensure that newly generated libraries are published appropriately when running end to end tests.

## The Previous Version

The previous version of the `tools/start-local-registry.ts` script used publish targets on each project to publish the packages to the local registry. This is no longer necessary with Nx Release. You can identify the previous version by the `nx run-many` command that publishes the packages:

```typescript
/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { execFileSync } from 'child_process';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@demo-plugin-1800/source:local-registry';
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
    ['run-many', '--targets', 'publish', '--ver', '0.0.0-e2e', '--tag', 'e2e'],
    { env: process.env, stdio: 'inherit' }
  );
};
```

If your script looks like this, you should update it.

## The Updated Version

The updated version of the `tools/start-local-registry.ts` script uses Nx Release to publish the packages to the local registry. This is done by running `releaseVersion` and `releasePublish` functions from `nx/release`. Your updated script should look like this:

```typescript
/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { execFileSync } from 'child_process';
import { releasePublish, releaseVersion } from 'nx/release';

export default async () => {
  // local registry target to run
  const localRegistryTarget = '@demo-plugin-1800/source:local-registry';
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
      skipLockFileUpdate: true,
    },
  });
  await releasePublish({
    tag: 'e2e',
    firstRelease: true,
  });
};
```
