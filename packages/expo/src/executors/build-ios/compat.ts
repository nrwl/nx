import { convertNxExecutor } from '@nrwl/devkit';

import buildIosExecutor from './build-ios.impl';

export default convertNxExecutor(buildIosExecutor);
