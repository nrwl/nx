import { readNxJson } from '../../../config/nx-json';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils';
import { executeNxCloudCommand, warnNotConnectedToCloud } from '../utils';

export interface StopAllAgentsArgs {
  verbose?: boolean;
}

export function stopAllAgentsHandler(args: StopAllAgentsArgs): Promise<number> {
  if (!isNxCloudUsed(readNxJson())) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('stop-all-agents', args.verbose);
}
