import { executeNxCloudCommand } from '../utils';

export interface StartAgentArgs {
  verbose?: boolean;
}

export function startAgentHandler(args: StartAgentArgs): Promise<number> {
  return executeNxCloudCommand('start-agent', args.verbose);
}
