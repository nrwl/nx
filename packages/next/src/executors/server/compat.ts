import { convertNxExecutor } from '@nrwl/devkit';

import serverExecutor from './server.impl';

export default convertNxExecutor(serverExecutor);
