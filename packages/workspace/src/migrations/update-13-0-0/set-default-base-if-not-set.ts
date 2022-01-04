import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { output } from '../../utilities/output';

export async function setDefaultBaseIfNotSet(host: Tree) {
  const config = readWorkspaceConfiguration(host);
  if (!config.affected?.defaultBase) {
    config.affected ??= {};
    config.affected.defaultBase ??= 'master';

    output.note({
      title: 'Default Base has been set in nx.json',
      bodyLines: [
        `Nx is moving to "main" as the default branch.`,
        `To avoid your current defaults changing, defaultBase has been set to "master" in nx.json`,
        `Read more here: https://nx.dev/using-nx/affected`,
      ],
    });
  }
  updateWorkspaceConfiguration(host, config);
  await formatFiles(host);
}

export default setDefaultBaseIfNotSet;
