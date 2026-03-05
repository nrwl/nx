import { executeNxCloudCommand } from '../utils';

export interface PolygraphArgs {
  verbose?: boolean;
}

export function polygraphHandler(args: PolygraphArgs): Promise<number> {
  return executeNxCloudCommand('polygraph', args.verbose);
}
