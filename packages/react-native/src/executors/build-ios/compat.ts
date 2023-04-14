import { convertNxExecutor } from '@nx/devkit';

import buildIosExecutor from './build-ios.impl';

export default convertNxExecutor(buildIosExecutor);
