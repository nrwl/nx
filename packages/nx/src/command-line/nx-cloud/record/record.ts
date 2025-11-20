import { executeNxCloudCommand } from '../utils';

export interface RecordArgs {
  verbose?: boolean;
}

export function recordHandler(args: RecordArgs): Promise<number> {
  return executeNxCloudCommand('record', args.verbose);
}
