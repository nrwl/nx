import { convertNxExecutor } from '@nrwl/devkit';

import lintExecutor from './lint.impl';

export default convertNxExecutor(lintExecutor);
