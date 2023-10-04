import { convertNxExecutor } from '@nx/devkit';

import { default as jestExecutor } from './jest.impl';

export default convertNxExecutor(jestExecutor);
