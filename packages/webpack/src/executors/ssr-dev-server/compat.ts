import { convertNxExecutor } from '@nrwl/devkit';

import ssrDevServerExecutor from './ssr-dev-server.impl';

export default convertNxExecutor(ssrDevServerExecutor);
