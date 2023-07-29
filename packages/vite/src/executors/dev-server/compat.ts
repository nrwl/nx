import { convertNxExecutor } from '@nx/devkit';
import viteDevServerExecutor from './dev-server.impl';

export default convertNxExecutor(viteDevServerExecutor);
