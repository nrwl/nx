import { executeNxCloudCommand } from '../utils';

export interface LoginArgs {
  nxCloudUrl?: string;
  verbose?: boolean;
}

export function loginHandler(args: LoginArgs): Promise<number> {
  if (args.nxCloudUrl) {
    process.env.NX_CLOUD_API = args.nxCloudUrl;
  }

  return executeNxCloudCommand('login', args.verbose);
}
