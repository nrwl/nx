import {
  executeNxCloudCommand,
  isConnectedToNxCloud,
  warnNotConnectedToCloud,
} from '../utils';

export interface FixCiArgs {
  verbose?: boolean;
}

export function fixCiHandler(args: FixCiArgs): Promise<number> {
  if (!isConnectedToNxCloud()) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('fix-ci', args.verbose);
}
