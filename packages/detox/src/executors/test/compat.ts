import { convertNxExecutor } from '@nrwl/devkit';

import detoxTestExecutor from './test.impl';

export default convertNxExecutor(detoxTestExecutor);
