import { convertNxExecutor } from '@nrwl/devkit';

import runAndroidExecutor from './run-android.impl';

export default convertNxExecutor(runAndroidExecutor);
