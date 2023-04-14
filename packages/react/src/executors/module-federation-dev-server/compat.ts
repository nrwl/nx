import { convertNxExecutor } from '@nx/devkit';

import devServer from './module-federation-dev-server.impl';

export default convertNxExecutor(devServer);
