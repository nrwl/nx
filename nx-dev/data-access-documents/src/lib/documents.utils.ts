import { join } from 'path';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';

export const archiveRootPath = join(appRootPath, 'nx-dev/archive');
export const previewRootPath = join(appRootPath, 'docs');
