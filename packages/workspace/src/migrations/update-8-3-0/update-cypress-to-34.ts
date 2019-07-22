import { updateJsonInTree } from '@nrwl/workspace';
import { chain, SchematicContext } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

const updateCypress = updateJsonInTree('package.json', json => {
  json.devDependencies = json.devDependencies || {};
  if (json.devDependencies['cypress']) {
    json.devDependencies['cypress'] = '3.4.0';
  }

  return json;
});

const addInstall = (_: any, context: SchematicContext) => {
  context.addTask(new NodePackageInstallTask());
};

export default function() {
  return chain([updateCypress, addInstall]);
}
