import { convertNxExecutor } from '@nx/devkit';

import nxBrowserEsBuild from './browser-esbuild.impl';

export default convertNxExecutor(nxBrowserEsBuild);
