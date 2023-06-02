import { convertNxExecutor } from '@nx/devkit';
import { nxPluginE2EExecutor } from './e2e.impl';

export const nxPluginE2EBuilder = convertNxExecutor(nxPluginE2EExecutor);
