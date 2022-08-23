import { convertNxExecutor } from '@nrwl/devkit';

import rollbackExecutor from './rollback.impl';

export default convertNxExecutor(rollbackExecutor);
