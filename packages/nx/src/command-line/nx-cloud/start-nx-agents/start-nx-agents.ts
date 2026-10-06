import { readNxJson } from '../../../config/nx-json';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils';
import { executeNxCloudCommand, warnNotConnectedToCloud } from '../utils';

export interface StartNxAgentsArgs {
  verbose?: boolean;
}

export function startNxAgentsHandler(args: StartNxAgentsArgs): Promise<number> {
  if (!isNxCloudUsed(readNxJson())) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('start-nx-agents', args.verbose);
}
