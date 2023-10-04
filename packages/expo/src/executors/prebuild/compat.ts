import { convertNxExecutor } from '@nx/devkit';

import prebuildExecutor from './prebuild.impl';

export default convertNxExecutor(prebuildExecutor);
