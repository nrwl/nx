import { convertNxExecutor } from '@nrwl/devkit';

import buildExecutor from './update.impl';

export default convertNxExecutor(buildExecutor);
