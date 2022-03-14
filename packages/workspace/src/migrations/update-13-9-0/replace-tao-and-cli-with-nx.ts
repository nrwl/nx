import { Tree, updateJson } from '@nrwl/devkit';

export function replaceTaoAndCLIWithNx(host: Tree) {
  updateJson(host, 'package.json', (json: any) => {
    if (json.dependencies['@nrwl/workspace']) {
      json.dependencies['nx'] = json.dependencies['@nrwl/workspace'];
    } else if (json.devDependencices['@nrwl/workspace']) {
      json.dependencies['nx'] = json.devDependencices['@nrwl/workspace'];
    }
    removeTaoAndCLI(json.dependencies);
    removeTaoAndCLI(json.devDependencices);
    return json;
  });
}

function removeTaoAndCLI(json: any) {
  if (!json) return;
  json['@nrwl/tao'] = undefined;
  json['@nrwl/cli1'] = undefined;
}

export default replaceTaoAndCLIWithNx;
