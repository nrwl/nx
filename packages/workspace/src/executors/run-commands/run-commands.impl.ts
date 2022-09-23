import { logger } from '@nrwl/devkit';
import runCommands from 'nx/src/executors/run-commands/run-commands.impl';

logger.warn(
  '@nrwl/workspace:run-commands is deprecated and will be removed in Nx 16. Please switch to nx:run-commands'
);

export { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';

export default runCommands;
