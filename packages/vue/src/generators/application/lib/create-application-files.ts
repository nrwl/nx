import * as path from 'path';
import { generateFiles, offsetFromRoot, Tree } from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';

import { createTsConfig } from '../../../utils/create-ts-config';
import { NormalizedSchema } from '../schema';
import {
  getNxCloudAppOnBoardingUrl,
  createNxCloudOnboardingURLForWelcomeApp,
} from 'nx/src/nx-cloud/utilities/onboarding';

export async function createApplicationFiles(
  tree: Tree,
  options: NormalizedSchema
) {
  const onBoardingStatus = await createNxCloudOnboardingURLForWelcomeApp(
    tree,
    options.nxCloudToken
  );

  const connectCloudUrl =
    onBoardingStatus === 'unclaimed' &&
    (await getNxCloudAppOnBoardingUrl(options.nxCloudToken));

  generateFiles(
    tree,
    path.join(__dirname, '../files/common'),
    options.appProjectRoot,
    {
      ...options,
      offsetFromRoot: offsetFromRoot(options.appProjectRoot),
      title: options.projectName,
    }
  );

  generateFiles(
    tree,
    path.join(__dirname, '../files/nx-welcome', onBoardingStatus),
    options.appProjectRoot,
    {
      ...options,
      connectCloudUrl,
      offsetFromRoot: offsetFromRoot(options.appProjectRoot),
      title: options.projectName,
    }
  );

  if (options.style !== 'none') {
    generateFiles(
      tree,
      path.join(__dirname, '../files/stylesheet'),
      options.appProjectRoot,
      {
        ...options,
        offsetFromRoot: offsetFromRoot(options.appProjectRoot),
        title: options.projectName,
      }
    );
  }

  if (options.routing) {
    generateFiles(
      tree,
      path.join(__dirname, '../files/routing'),
      options.appProjectRoot,
      {
        ...options,
        offsetFromRoot: offsetFromRoot(options.appProjectRoot),
        title: options.projectName,
      }
    );
  }

  createTsConfig(
    tree,
    options.appProjectRoot,
    'app',
    options,
    getRelativePathToRootTsConfig(tree, options.appProjectRoot)
  );
}
