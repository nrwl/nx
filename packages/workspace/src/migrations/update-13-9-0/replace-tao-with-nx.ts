import {
  getPackageManagerCommand,
  logger,
  Tree,
  updateJson,
} from '@nrwl/devkit';

export function replaceTaoWithNx(host: Tree) {
  updateJson(host, 'package.json', (json: any) => {
    if (json.dependencies?.['@nrwl/workspace']) {
      json.dependencies['nx'] = json.dependencies['@nrwl/workspace'];
    } else if (json.devDependencies?.['@nrwl/workspace']) {
      json.devDependencies['nx'] = json.devDependencies['@nrwl/workspace'];
    }
    removeTao(json.dependencies);
    removeTao(json.devDependencies);
    return json;
  });
  const pmc = getPackageManagerCommand();
  logger.info(
    `Please run ${pmc.install} to ensure the correct version of Nx is installed.`
  );
}

function removeTao(json: any) {
  if (!json) return;
  json['@nrwl/tao'] = undefined;
}

export default replaceTaoWithNx;
