import { findAncestorNodeModules } from '../resolution-helpers';
import { verifyOrUpdateNxCloudClient } from '../update-manager';
import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';

export class UnknownCommandError extends Error {
  constructor(
    public command: string,
    public availableCommands: string[]
  ) {
    super(`Unknown Command "${command}"`);
  }
}

export async function getCloudClient(options: CloudTaskRunnerOptions) {
  const { nxCloudClient } = await verifyOrUpdateNxCloudClient(options);

  const paths = findAncestorNodeModules(__dirname, []);
  nxCloudClient.configureLightClientRequire()(paths);

  const runCLI = nxCloudClient.runCLI;

  return {
    invoke: (command: string, exit = true) => {
      if (command in nxCloudClient.commands) {
        return nxCloudClient.commands[command]()
          .then(() => {
            if (exit) {
              process.exit(0);
            }
          })
          .catch((e: unknown) => {
            console.error(e);
            if (exit) {
              process.exit(1);
            }
            throw e;
          });
      } else {
        throw new UnknownCommandError(
          command,
          Object.keys(nxCloudClient.commands)
        );
      }
    },
    availableCommands: Object.keys(nxCloudClient.commands),
    // Bundles that export runCLI own dispatch, help, output and the exit code.
    // Older bundles only export `commands`.
    runCLI:
      typeof runCLI === 'function'
        ? (args: string[]) => runCLI.call(nxCloudClient, args)
        : undefined,
  };
}
