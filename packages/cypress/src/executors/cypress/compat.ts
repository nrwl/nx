import { convertNxExecutor } from '@nx/devkit';

import { default as cypressExecutor } from './cypress.impl';

export default convertNxExecutor(cypressExecutor);
