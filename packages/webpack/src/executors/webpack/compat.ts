import { convertNxExecutor } from '@nx/devkit';

import { webpackExecutor } from './webpack.impl';

export default convertNxExecutor(webpackExecutor);
