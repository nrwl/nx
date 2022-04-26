import { generateFiles, joinPathFragments, Tree } from '@nrwl/devkit';
import { join } from 'path';
import { normalizeOptions } from './normalize-options';

import { UpgradeNativeConfigureSchema } from '../schema';

export function createNativeFiles(
  host: Tree,
  schema: UpgradeNativeConfigureSchema,
  root: string
) {
  const options = normalizeOptions(schema);

  const iosProjectRoot = joinPathFragments(root, 'ios');
  const androidProjectRoot = joinPathFragments(root, 'android');

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
