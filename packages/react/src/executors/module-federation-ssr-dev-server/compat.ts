import { convertNxExecutor } from '@nx/devkit';

import ssrDevServer from './module-federation-ssr-dev-server.impl';

export default convertNxExecutor(ssrDevServer);
