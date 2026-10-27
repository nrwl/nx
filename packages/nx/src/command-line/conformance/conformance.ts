import type { ArgumentsCamelCase, CommandModule } from 'yargs';
import { readNxJson } from '../../config/nx-json';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { executeNxCloudCommand } from '../nx-cloud/utils';
import type { ConformanceCommand } from './command-object';

// Connected workspaces run conformance through the Nx Cloud client, which
// layers Cloud rules and reporting over the same @nx/conformance engine.
export async function conformanceHandler(
  command: ConformanceCommand,
  args: ArgumentsCamelCase<{ verbose?: boolean }>,
  localHandler: CommandModule['handler']
) {
  if (isNxCloudUsed(readNxJson())) {
    process.exit(await executeNxCloudCommand(command, args.verbose));
  }
  return localHandler(args);
}
