import { convertNxExecutor } from '@nrwl/devkit';

import rollupExecutor from './rollup.impl';

export default convertNxExecutor(rollupExecutor);
