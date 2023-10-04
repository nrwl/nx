import { convertNxExecutor } from '@nx/devkit';

import serverExecutor from './server.impl';

export default convertNxExecutor(serverExecutor);
