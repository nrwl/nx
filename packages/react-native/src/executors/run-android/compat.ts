import { convertNxExecutor } from '@nx/devkit';

import runAndroidExecutor from './run-android.impl';

export default convertNxExecutor(runAndroidExecutor);
