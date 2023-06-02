import { convertNxExecutor } from '@nx/devkit';

import buildListExecutor from './build-list.impl';

export default convertNxExecutor(buildListExecutor);
