import {
  executeNxCloudCommand,
  isConnectedToNxCloud,
  warnNotConnectedToCloud,
} from '../utils';

export interface StopAllAgentsArgs {
  verbose?: boolean;
}

export function stopAllAgentsHandler(args: StopAllAgentsArgs): Promise<number> {
  if (!isConnectedToNxCloud()) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('stop-all-agents', args.verbose);
}
