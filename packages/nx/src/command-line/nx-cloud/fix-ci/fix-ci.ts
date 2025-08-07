import { executeNxCloudCommand } from '../utils';

export interface FixCiArgs {
  verbose?: boolean;
}

export function fixCiHandler(args: FixCiArgs): Promise<number> {
  return executeNxCloudCommand('fix-ci', args.verbose);
}
