import {
  getOutputsForTargetAndConfiguration,
  normalizePath,
  readProjectConfiguration,
  Tree,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import { join, relative } from 'path';
import type { NormalizedSchema } from '../schema';

export function updateNgPackage(tree: Tree, schema: NormalizedSchema): void {
  const project = readProjectConfiguration(tree, schema.newProjectName);

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
        project: schema.newProjectName,
        target: 'build',
      },
      overrides: {},
    },
    {
      name: schema.newProjectName,
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
