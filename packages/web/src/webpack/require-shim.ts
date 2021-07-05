import { join } from 'path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';

export function requireShim(path: string) {
  try {
    return require(join(appRootPath, 'node_modules', path));
  } catch {
    return require(path);
  }
}
