import {
  executeNxCloudCommand,
  isConnectedToNxCloud,
  warnNotConnectedToCloud,
} from '../utils';

export interface StartCiRunArgs {
  verbose?: boolean;
}

export function startCiRunHandler(args: StartCiRunArgs): Promise<number> {
  if (!isConnectedToNxCloud()) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('start-ci-run', args.verbose);
}
