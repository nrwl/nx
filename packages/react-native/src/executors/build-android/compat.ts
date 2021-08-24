import { convertNxExecutor } from '@nrwl/devkit';

import buildAndroidExecutor from './build-android.impl';

export default convertNxExecutor(buildAndroidExecutor);
