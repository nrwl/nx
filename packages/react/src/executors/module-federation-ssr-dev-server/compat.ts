import { convertNxExecutor } from '@nrwl/devkit';

import ssrDevServer from './module-federation-ssr-dev-server.impl';

export default convertNxExecutor(ssrDevServer);
