import { convertNxExecutor } from '@nrwl/devkit';
import { nxPluginE2EExecutor } from './e2e.impl';

export const nxPluginE2EBuilder = convertNxExecutor(nxPluginE2EExecutor);
