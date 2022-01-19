import { joinPathFragments } from '@nrwl/devkit';
import { existsSync } from 'fs';

export function isSecondaryEntrypoint(path: string) {
  return path.endsWith('src/index.ts')
    ? existsSync(joinPathFragments(path, '../../', 'ng-package.json'))
    : false;
}
