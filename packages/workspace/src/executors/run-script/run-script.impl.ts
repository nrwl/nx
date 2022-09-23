import { logger } from '@nrwl/devkit';
import runScript from 'nx/src/executors/run-script/run-script.impl';

logger.warn(
  '@nrwl/workspace:run-script is deprecated and will be removed in Nx 16. Please switch to nx:run-script'
);

export { RunScriptOptions } from 'nx/src/executors/run-script/run-script.impl';

export default runScript;
