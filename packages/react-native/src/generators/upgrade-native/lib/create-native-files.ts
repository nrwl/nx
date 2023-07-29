import { generateFiles, joinPathFragments, Tree } from '@nx/devkit';
import { join } from 'path';
import { normalizeOptions } from './normalize-options';

import { UpgradeNativeConfigureSchema } from '../schema';

export function createNativeFiles(
  host: Tree,
  schema: UpgradeNativeConfigureSchema,
  appProjectRoot: string
) {
  const options = normalizeOptions(schema, appProjectRoot);

  const iosProjectRoot = joinPathFragments(appProjectRoot, 'ios');
  const androidProjectRoot = joinPathFragments(appProjectRoot, 'android');

  generateFiles(
    host,
    join(__dirname, '../../application/files/app/ios'),
    iosProjectRoot,
    options
  );

  generateFiles(
    host,
    join(__dirname, '../../application/files/app/android'),
    androidProjectRoot,
    options
  );
}
