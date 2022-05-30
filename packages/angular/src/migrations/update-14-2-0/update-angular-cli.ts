import { formatFiles, Tree, updateJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  let shouldFormat = false;

  updateJson(tree, 'package.json', (json) => {
    if (json.devDependencies?.['@angular/cli']) {
      json.devDependencies['@angular/cli'] = '~14.0.0-rc.2';
      shouldFormat = true;
    } else if (json.dependencies?.['@angular/cli']) {
      json.dependencies['@angular/cli'] = '~14.0.0-rc.2';
      shouldFormat = true;
    }

    return json;
  });

  if (shouldFormat) {
    await formatFiles(tree);
  }
}
