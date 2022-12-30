import { convertNxExecutor } from '@nrwl/devkit';

import { default as runCommandsExecutor } from './run-commands.impl';

export default convertNxExecutor(runCommandsExecutor);
