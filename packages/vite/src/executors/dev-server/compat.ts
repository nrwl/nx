import { convertNxExecutor } from '@nrwl/devkit';
import viteDevServerExecutor from './dev-server.impl';

export default convertNxExecutor(viteDevServerExecutor);
