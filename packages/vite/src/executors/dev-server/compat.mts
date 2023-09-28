import { convertNxExecutor } from '@nx/devkit';
import viteDevServerExecutor from './dev-server.impl.mjs';

export default convertNxExecutor(viteDevServerExecutor);
