import { readNxJson } from '../../../config/nx-json';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils';
import { executeNxCloudCommand, warnNotConnectedToCloud } from '../utils';

export interface FixCiArgs {
  verbose?: boolean;
}

export function fixCiHandler(args: FixCiArgs): Promise<number> {
  if (!isNxCloudUsed(readNxJson())) {
    warnNotConnectedToCloud();
    return Promise.resolve(0);
  }
  return executeNxCloudCommand('fix-ci', args.verbose);
}
