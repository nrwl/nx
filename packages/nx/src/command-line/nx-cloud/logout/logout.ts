import { executeNxCloudCommand } from '../utils.js';

export interface LogoutArgs {
  verbose?: boolean;
}

export function logoutHandler(args: LogoutArgs): Promise<number> {
  return executeNxCloudCommand('logout', args.verbose);
}
