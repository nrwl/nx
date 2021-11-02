import { convertNxExecutor } from '@nrwl/devkit';

import runIosExecutor from './run-ios.impl';

export default convertNxExecutor(runIosExecutor);
