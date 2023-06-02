import { convertNxExecutor } from '@nx/devkit';

import bundleExecutor from './bundle.impl';

export default convertNxExecutor(bundleExecutor);
