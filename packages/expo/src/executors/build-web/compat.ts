import { convertNxExecutor } from '@nrwl/devkit';

import buildWebExecutor from './build-web.impl';

export default convertNxExecutor(buildWebExecutor);
