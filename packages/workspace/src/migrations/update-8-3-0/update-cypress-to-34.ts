import { addInstallTask, formatFiles, updateJsonInTree } from '@nrwl/workspace';
import { chain } from '@angular-devkit/schematics';

const updateCypress = updateJsonInTree('package.json', (json) => {
  json.devDependencies = json.devDependencies || {};
  if (json.devDependencies['cypress']) {
    json.devDependencies['cypress'] = '3.4.0';
  }

  return json;
});

export default function () {
  return chain([updateCypress, addInstallTask(), formatFiles()]);
}
