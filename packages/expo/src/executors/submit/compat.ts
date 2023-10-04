import { convertNxExecutor } from '@nx/devkit';

import submitExecutor from './submit.impl';

export default convertNxExecutor(submitExecutor);
