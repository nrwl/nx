import { Tree, getProjects, updateJson } from '@nx/devkit';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, config] of projects.entries()) {
    if (config.targets?.['start']?.executor === '@nx/expo:start') {
      updateJson(tree, `${config.root}/eas.json`, (easJson) => {
        if (easJson?.cli?.version) {
          easJson.cli.version = `>= 5`;
        }
        return easJson;
      });
    }
  }
}
