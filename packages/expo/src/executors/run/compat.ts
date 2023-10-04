import { convertNxExecutor } from '@nx/devkit';

import runExecutor from './run.impl';

export default convertNxExecutor(runExecutor);
