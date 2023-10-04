import { convertNxExecutor } from '@nx/devkit';

import { ngPackagrLiteExecutor } from './ng-packagr-lite.impl';

export default convertNxExecutor(ngPackagrLiteExecutor);
