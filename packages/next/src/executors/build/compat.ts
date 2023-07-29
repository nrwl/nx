import { convertNxExecutor } from '@nx/devkit';

import buildExecutor from './build.impl';

export default convertNxExecutor(buildExecutor);
