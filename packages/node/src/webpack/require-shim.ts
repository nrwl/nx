import { join } from 'path';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

export function requireShim(path: string) {
  try {
    return require(join(appRootPath, 'node_modules', path));
  } catch {
    return require(path);
  }
}
