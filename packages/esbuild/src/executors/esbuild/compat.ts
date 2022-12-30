import { convertNxExecutor } from '@nrwl/devkit';

import esbuildExecutor from './esbuild.impl';

export default convertNxExecutor(esbuildExecutor);
