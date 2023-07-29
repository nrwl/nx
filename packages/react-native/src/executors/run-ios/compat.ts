import { convertNxExecutor } from '@nx/devkit';

import runIosExecutor from './run-ios.impl';

export default convertNxExecutor(runIosExecutor);
