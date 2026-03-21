import { executeNxCloudCommand } from '../utils';

export interface LogoutArgs {
  verbose?: boolean;
}

export function logoutHandler(args: LogoutArgs): Promise<number> {
  return executeNxCloudCommand('logout', args.verbose);
}
