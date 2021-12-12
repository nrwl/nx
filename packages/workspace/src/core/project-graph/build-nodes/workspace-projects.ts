import {
  ProjectGraphBuilder,
  ProjectGraphProcessorContext,
} from '@nrwl/devkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { mergeNpmScriptsWithTargets } from '../../../utilities/project-graph-utils';

export function buildWorkspaceProjectNodes(
  ctx: ProjectGraphProcessorContext,
  builder: ProjectGraphBuilder
) {
  const toAdd = [];
  Object.keys(ctx.workspace.projects).forEach((key) => {
    const p = ctx.workspace.projects[key];
    if (existsSync(join(p.root, 'package.json'))) {
      p.targets = mergeNpmScriptsWithTargets(p.root, p.targets);
    }
    const projectType =
      p.projectType === 'application'
        ? key.endsWith('-e2e')
          ? 'e2e'
          : 'app'
        : 'lib';
    const tags =
      ctx.workspace.projects && ctx.workspace.projects[key]
        ? ctx.workspace.projects[key].tags || []
        : [];

    toAdd.push({
      name: key,
      type: projectType,
      data: {
        ...p,
        tags,
        files: ctx.fileMap[key],
      },
    });
  });

  // Sort by root directory length (do we need this?)
  toAdd.sort((a, b) => {
    if (!a.data.root) return -1;
    if (!b.data.root) return -1;
    return a.data.root.length > b.data.root.length ? -1 : 1;
  });

  toAdd.forEach((n) => {
    builder.addNode({
      name: n.name,
      type: n.type,
      data: n.data,
    });
  });
}
