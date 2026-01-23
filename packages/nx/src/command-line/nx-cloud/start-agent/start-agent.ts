import { readNxJson } from '../../../config/nx-json';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils';
import { executeNxCloudCommand, warnNotConnectedToCloud } from '../utils';

export interface StartAgentArgs {
  verbose?: boolean;
}

export function startAgentHandler(args: StartAgentArgs): Promise<number> {
  if (!isNxCloudUsed(readNxJson())) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('start-agent', args.verbose);
}
