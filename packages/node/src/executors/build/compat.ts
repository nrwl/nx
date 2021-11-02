import { convertNxExecutor } from '@nrwl/devkit';

import { buildExecutor } from './build.impl';

export default convertNxExecutor(buildExecutor);
