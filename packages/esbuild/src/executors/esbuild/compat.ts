import { convertNxExecutor } from '@nx/devkit';

import esbuildExecutor from './esbuild.impl';

export default convertNxExecutor(esbuildExecutor);
