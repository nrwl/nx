import {
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';
import { Tree } from '../../generators/tree';
import { updateJson } from '../../generators/utils/json';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    if (json.dependencies && json.dependencies['@nrwl/nx-cloud']) {
      json.dependencies['nx-cloud'] = json.dependencies['@nrwl/nx-cloud'];
      delete json.dependencies['@nrwl/nx-cloud'];
    }

    if (json.devDependencies && json.devDependencies['@nrwl/nx-cloud']) {
      json.devDependencies['nx-cloud'] = json.devDependencies['@nrwl/nx-cloud'];
      delete json.devDependencies['@nrwl/nx-cloud'];
    }

    return json;
  });

  const nxJson = readNxJson(tree);
  if (!nxJson) return;
  for (let opts of Object.values(nxJson.tasksRunnerOptions)) {
    if (opts.runner === '@nrwl/nx-cloud') {
      opts.runner = 'nx-cloud';
    }
  }
  updateNxJson(tree, nxJson);
}
