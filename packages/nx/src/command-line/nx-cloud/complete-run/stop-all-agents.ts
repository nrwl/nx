import { executeNxCloudCommand } from '../utils';

export interface StopAllAgentsArgs {
  verbose?: boolean;
}

export function stopAllAgentsHandler(args: StopAllAgentsArgs): Promise<number> {
  return executeNxCloudCommand('stop-all-agents', args.verbose);
}
