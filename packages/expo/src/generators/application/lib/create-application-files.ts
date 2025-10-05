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

export async function createApplicationFiles(
  host: Tree,
  options: NormalizedSchema
) {
  const packageManager = detectPackageManager(host.root);

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
