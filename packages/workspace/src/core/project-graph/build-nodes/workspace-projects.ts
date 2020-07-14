import { AddProjectNode, ProjectGraphContext } from '../project-graph-models';

export function buildWorkspaceProjectNodes(
  ctx: ProjectGraphContext,
  addNode: AddProjectNode,
  fileRead: (s: string) => string
) {
  const toAdd = [];

  Object.keys(ctx.fileMap).forEach((key) => {
    const p = ctx.workspaceJson.projects[key];

    // TODO, types and projectType should allign
    const projectType =
      p.projectType === 'application'
        ? key.endsWith('-e2e')
          ? 'e2e'
          : 'app'
        : 'lib';
    const tags =
      ctx.nxJson.projects && ctx.nxJson.projects[key]
        ? ctx.nxJson.projects[key].tags || []
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
    addNode({
      name: n.name,
      type: n.type,
      data: n.data,
    });
  });
}
