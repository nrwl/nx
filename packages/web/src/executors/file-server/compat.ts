import { convertNxExecutor } from '@nx/devkit';

import fileServerExecutor from './file-server.impl';

export default convertNxExecutor(fileServerExecutor);
