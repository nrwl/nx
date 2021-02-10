import { convertNxExecutor } from '@nrwl/devkit';

import fileServerExecutor from './file-server.impl';

export default convertNxExecutor(fileServerExecutor);
