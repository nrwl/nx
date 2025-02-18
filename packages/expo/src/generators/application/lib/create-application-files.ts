import {
  detectPackageManager,
  generateFiles,
  offsetFromRoot,
  PackageManager,
  toJS,
  Tree,
} from '@nx/devkit';
import { execSync } from 'node:child_process';
import {
  createNxCloudOnboardingURLForWelcomeApp,
  getNxCloudAppOnBoardingUrl,
} from 'nx/src/nx-cloud/utilities/onboarding';
import { join } from 'path';
import { gte } from 'semver';
import { NormalizedSchema } from './normalize-options';

export async function createApplicationFiles(
  host: Tree,
  options: NormalizedSchema
) {
  const packageManagerLockFile: Record<PackageManager, string> = {
    npm: 'package-lock.json',
    yarn: 'yarn.lock',
    pnpm: 'pnpm-lock.yaml',
    bun: (() => {
      try {
        // In version 1.2.0, bun switched to a text based lockfile format by default
        return gte(execSync('bun --version').toString().trim(), '1.2.0')
          ? 'bun.lock'
          : 'bun.lockb';
      } catch {
        return 'bun.lockb';
      }
    })(),
  };
  const packageManager = detectPackageManager(host.root);
  const packageLockFile = packageManagerLockFile[packageManager];

  const onBoardingStatus = await createNxCloudOnboardingURLForWelcomeApp(
    host,
    options.nxCloudToken
  );

  const connectCloudUrl =
    onBoardingStatus === 'unclaimed' &&
    (await getNxCloudAppOnBoardingUrl(options.nxCloudToken));

  generateFiles(
    host,
    join(__dirname, '../files/base'),
    options.appProjectRoot,
    {
      ...options,
      offsetFromRoot: offsetFromRoot(options.appProjectRoot),
      packageManager,
      packageLockFile,
    }
  );

  generateFiles(
    host,
    join(__dirname, `../files/nx-welcome/${onBoardingStatus}`),
    options.appProjectRoot,
    {
      ...options,
      connectCloudUrl,
      offsetFromRoot: offsetFromRoot(options.appProjectRoot),
      packageManager,
      packageLockFile,
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(join(options.appProjectRoot, `App.spec.tsx`));
  }
  if (options.js) {
    toJS(host);
  }
}
