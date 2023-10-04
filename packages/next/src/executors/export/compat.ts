import { convertNxExecutor } from '@nx/devkit';

import exportExecutor from './export.impl';

export default convertNxExecutor(exportExecutor);
