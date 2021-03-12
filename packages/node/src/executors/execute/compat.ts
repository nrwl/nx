import { convertNxExecutor } from '@nrwl/devkit';

import { executeExecutor } from './execute.impl';

export default convertNxExecutor(executeExecutor);
