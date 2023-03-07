import {
  getOutputsForTargetAndConfiguration,
  normalizePath,
  readProjectConfiguration,
  Tree,
  updateJson,
  workspaceRoot,
} from '@nrwl/devkit';
import { getNewProjectName } from '../../utils/get-new-project-name';
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

  const rootOffset = normalizePath(
    relative(join(workspaceRoot, project.root), workspaceRoot)
  );
  const outputs = getOutputsForTargetAndConfiguration(
    {
      target: {
        project: newProjectName,
        target: 'build',
      },
      overrides: {},
    },
    {
      name: newProjectName,
      type: 'lib',
      data: {
        root: project.root,
        targets: project.targets,
      },
    } as any
  );

  const output = outputs[0] ?? `dist/${project.root}`;

  updateJson(tree, ngPackagePath, (json) => {
    json.dest = `${rootOffset}/${output}`;
    return json;
  });
}
