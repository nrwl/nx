import { convertNxExecutor } from '@nx/devkit';

import buildExecutor from './update.impl';

export default convertNxExecutor(buildExecutor);
