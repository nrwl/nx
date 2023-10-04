import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { output } from '../../utilities/output';

export async function setDefaultBaseIfNotSet(host: Tree) {
  const config = readNxJson(host);
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
  updateNxJson(host, config);
  await formatFiles(host);
}

export default setDefaultBaseIfNotSet;
