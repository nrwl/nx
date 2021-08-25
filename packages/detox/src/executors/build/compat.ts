import { convertNxExecutor } from '@nrwl/devkit';

import detoxBuildExecutor from './build.impl';

export default convertNxExecutor(detoxBuildExecutor);
