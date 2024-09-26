import {
  detectPackageManager,
  generateFiles,
  offsetFromRoot,
  PackageManager,
  toJS,
  Tree,
} from '@nx/devkit';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';
import {
  getNxCloudAppOnBoardingUrl,
  createNxCloudOnboardingURLForWelcomeApp,
} from 'nx/src/nx-cloud/utilities/onboarding';

export async function createApplicationFiles(
  host: Tree,
  options: NormalizedSchema
) {
  const packageManagerLockFile: Record<PackageManager, string[]> = {
    npm: ['package-lock.json'],
    yarn: ['yarn.lock'],
    pnpm: ['pnpm-lock.yaml'],
    bun: ['bun.lockb', 'bun.lock'],
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
      packageLockFile:
        packageManager === 'bun' ? packageLockFile[1] : packageLockFile[0],
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
      packageLockFile:
        packageManager === 'bun' ? packageLockFile[1] : packageLockFile[0],
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(join(options.appProjectRoot, `App.spec.tsx`));
  }
  if (options.js) {
    toJS(host);
  }
}
