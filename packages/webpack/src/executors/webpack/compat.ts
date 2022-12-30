import { convertNxExecutor } from '@nrwl/devkit';

import { webpackExecutor } from './webpack.impl';

export default convertNxExecutor(webpackExecutor);
