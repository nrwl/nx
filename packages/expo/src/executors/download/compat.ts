import { convertNxExecutor } from '@nx/devkit';

import downloadExecutor from './download.impl';

export default convertNxExecutor(downloadExecutor);
