import { findAncestorNodeModules } from '../resolution-helpers';
import { verifyOrUpdateNxCloudClient } from '../update-manager';
import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

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

  return {
    invoke: (command: string, exit = true) => {
      if (command in nxCloudClient.commands) {
        nxCloudClient.commands[command]()
          .then(() => {
            if (exit) {
              exitAndFlushAnalytics(0);
            }
          })
          .catch((e) => {
            console.error(e);
            if (exit) {
              exitAndFlushAnalytics(1);
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
  };
}
