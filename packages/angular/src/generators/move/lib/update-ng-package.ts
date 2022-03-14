import { readProjectConfiguration, Tree, updateJson } from '@nrwl/devkit';
import { appRootPath } from 'nx/src/utils/app-root';
import { getNewProjectName } from '@nrwl/workspace/src/generators/move/lib/utils';
import { join, relative } from 'path';
import { Schema } from '../schema';

export function updateNgPackage(tree: Tree, schema: Schema): void {
  const newProjectName = getNewProjectName(schema.destination);
  const project = readProjectConfiguration(tree, newProjectName);

  if (project.projectType === 'application') {
    return;
  }

  const ngPackagePath = `${project.root}/ng-package.json`;
  if (!tree.exists(ngPackagePath)) {
    return;
  }

  const rootOffset = relative(join(appRootPath, project.root), appRootPath);
  let output = `dist/${project.root}`;
  if (project.targets?.build?.outputs?.length > 0) {
    output = project.targets.build.outputs[0];
  }

  updateJson(tree, ngPackagePath, (json) => {
    json.dest = `${rootOffset}/${output}`;
    return json;
  });
}
