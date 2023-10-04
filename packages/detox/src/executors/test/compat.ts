import { convertNxExecutor } from '@nx/devkit';

import detoxTestExecutor from './test.impl';

export default convertNxExecutor(detoxTestExecutor);
