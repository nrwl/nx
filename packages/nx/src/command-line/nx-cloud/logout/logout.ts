import {
  executeNxCloudCommand,
  isConnectedToNxCloud,
  warnNotConnectedToCloud,
} from '../utils';

export interface LogoutArgs {
  verbose?: boolean;
}

export function logoutHandler(args: LogoutArgs): Promise<number> {
  if (!isConnectedToNxCloud()) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('logout', args.verbose);
}
