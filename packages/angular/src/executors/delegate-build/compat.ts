import { convertNxExecutor } from '@nx/devkit';

import { delegateBuildExecutor } from './delegate-build.impl';

export default convertNxExecutor(delegateBuildExecutor);
