import { convertNxExecutor } from '@nx/devkit';

import lintExecutor from './lint.impl';

export default convertNxExecutor(lintExecutor);
