import { findAncestorNodeModules } from '../resolution-helpers';
import { verifyOrUpdateNxCloudClient } from '../update-manager';
import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';

export class UnknownCommandError extends Error {
  constructor(public command: string, public availableCommands: string[]) {
    super(`Unknown Command "${command}"`);
  }
}

export async function getCloudClient(options: CloudTaskRunnerOptions) {
  const { nxCloudClient } = await verifyOrUpdateNxCloudClient(options);

  const paths = findAncestorNodeModules(__dirname, []);
  nxCloudClient.configureLightClientRequire()(paths);

  return {
    invoke: (command: string) => {
      if (command in nxCloudClient.commands) {
        nxCloudClient.commands[command]()
          .then(() => process.exit(0))
          .catch((e) => {
            console.error(e);
            process.exit(1);
          });
      } else {
        throw new UnknownCommandError(
          command,
          Object.keys(nxCloudClient.commands)
        );
      }
    },
    availableCommands: Object.keys(nxCloudClient.commands),
  };
}
