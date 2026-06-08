import {
  detectPackageManager,
  generateFiles,
  offsetFromRoot,
  toJS,
  Tree,
} from '@nx/devkit';
import {
  createNxCloudOnboardingURLForWelcomeApp,
  getNxCloudAppOnBoardingUrl,
} from 'nx/src/nx-cloud/utilities/onboarding';
import { join } from 'path';
import { NormalizedSchema } from './normalize-options';
import { getInstalledExpoMajorVersion } from '../../../utils/version-utils';

export async function createApplicationFiles(
  host: Tree,
  options: NormalizedSchema
) {
  const packageManager = detectPackageManager(host.root);

  // Expo SDK 55+ ships Metro via `@expo/metro` instead of the standalone
  // `metro`/`metro-config`/`metro-resolver` packages. When undefined (no Expo
  // installed yet), default to the latest behavior (v56).
  const installedExpoMajor = getInstalledExpoMajorVersion(host);
  const usesExpoMetro =
    installedExpoMajor === undefined || installedExpoMajor >= 55;

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
      usesExpoMetro,
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
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(join(options.appProjectRoot, 'src/app/App.spec.tsx'));
  }
  if (options.js) {
    toJS(host);
  }
}
