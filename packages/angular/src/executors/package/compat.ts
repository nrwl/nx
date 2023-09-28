import { convertNxExecutor } from '@nx/devkit';

import { packageExecutor } from './package.impl.mjs';

export default convertNxExecutor(packageExecutor);
