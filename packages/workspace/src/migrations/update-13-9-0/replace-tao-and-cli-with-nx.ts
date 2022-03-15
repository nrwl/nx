import { Tree, updateJson } from '@nrwl/devkit';

export function replaceTaoAndCLIWithNx(host: Tree) {
  updateJson(host, 'package.json', (json: any) => {
    if (json.dependencies['@nrwl/workspace']) {
      json.dependencies['nx'] = json.dependencies['@nrwl/workspace'];
    } else if (json.devDependencies['@nrwl/workspace']) {
      json.devDependencies['nx'] = json.devDependencies['@nrwl/workspace'];
    }
    removeTaoAndCLI(json.dependencies);
    removeTaoAndCLI(json.devDependencies);
    return json;
  });
}

function removeTaoAndCLI(json: any) {
  if (!json) return;
  json['@nrwl/tao'] = undefined;
  json['@nrwl/cli'] = undefined;
}

export default replaceTaoAndCLIWithNx;
