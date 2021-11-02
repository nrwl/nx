import { convertNxExecutor } from '@nrwl/devkit';

import { default as jestExecutor } from './jest.impl';

export default convertNxExecutor(jestExecutor);
