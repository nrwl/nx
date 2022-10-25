import { convertNxExecutor } from '@nrwl/devkit';

import prebuildExecutor from './prebuild.impl';

export default convertNxExecutor(prebuildExecutor);
