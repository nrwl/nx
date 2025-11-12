import { ensurePackage } from '@nx/devkit';
import { typescriptVersion } from '../versions.js';

export function ensureTypescript() {
  return ensurePackage<typeof import('typescript')>(
    'typescript',
    typescriptVersion
  );
}
