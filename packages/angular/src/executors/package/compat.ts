import { convertNxExecutor } from '@nx/devkit';

import { packageExecutor } from './package.impl';

export default convertNxExecutor(packageExecutor);
