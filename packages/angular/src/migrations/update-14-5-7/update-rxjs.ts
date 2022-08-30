import { formatFiles, Tree, updateJson } from '@nrwl/devkit';
import { gte, minVersion } from 'semver';

const rxjsVersion = '~7.5.0';

export default async function (tree: Tree) {
  let shouldFormat = false;

  updateJson(tree, 'package.json', (json) => {
    if (
      json.devDependencies?.['rxjs'] &&
      gte(minVersion(json.devDependencies?.['rxjs']), '7.0.0')
    ) {
      json.devDependencies['rxjs'] = rxjsVersion;
      shouldFormat = true;
    } else if (
      json.dependencies?.['rxjs'] &&
      gte(minVersion(json.dependencies?.['rxjs']), '7.0.0')
    ) {
      json.dependencies['rxjs'] = rxjsVersion;
      shouldFormat = true;
    }

    return json;
  });

  if (shouldFormat) {
    await formatFiles(tree);
  }
}
