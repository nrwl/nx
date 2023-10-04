import { convertNxExecutor } from '@nx/devkit';

import rollupExecutor from './rollup.impl';

export default convertNxExecutor(rollupExecutor);
