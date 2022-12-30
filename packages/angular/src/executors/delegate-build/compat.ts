import { convertNxExecutor } from '@nrwl/devkit';

import { delegateBuildExecutor } from './delegate-build.impl';

export default convertNxExecutor(delegateBuildExecutor);
