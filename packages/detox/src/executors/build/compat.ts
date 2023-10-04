import { convertNxExecutor } from '@nx/devkit';

import detoxBuildExecutor from './build.impl';

export default convertNxExecutor(detoxBuildExecutor);
