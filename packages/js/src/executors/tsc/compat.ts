import { convertNxExecutor } from '@nx/devkit';

import { tscExecutor } from './tsc.impl';

export default convertNxExecutor(tscExecutor);
