import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  updateJson,
} from '@nx/devkit';
import { easCliVersion } from '../../utils/versions';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      updateJson(tree, `${config.root}/eas.json`, (easJson) => {
        if (easJson?.cli?.version) {
          easJson.cli.version = `>= ${easCliVersion.replace('~', '')}`;
        }
        return easJson;
      });
    }
  }
}
