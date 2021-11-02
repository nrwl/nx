import { convertNxExecutor } from '@nrwl/devkit';

import { default as cypressExecutor } from './cypress.impl';

export default convertNxExecutor(cypressExecutor);
