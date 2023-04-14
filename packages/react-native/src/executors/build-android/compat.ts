import { convertNxExecutor } from '@nx/devkit';

import buildAndroidExecutor from './build-android.impl';

export default convertNxExecutor(buildAndroidExecutor);
