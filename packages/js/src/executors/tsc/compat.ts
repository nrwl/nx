import { convertNxExecutor } from '@nrwl/devkit';

import { tscExecutor } from './tsc.impl';

export default convertNxExecutor(tscExecutor);
