import { convertNxExecutor } from '@nx/devkit';

import ssrDevServerExecutor from './ssr-dev-server.impl';

export default convertNxExecutor(ssrDevServerExecutor);
