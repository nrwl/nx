import { formatFiles, getProjects, Tree } from '@nrwl/devkit';
import {
  createProjectGraph,
  reverse,
} from '@nrwl/workspace/src/core/project-graph';
import { hasDependentAppUsingWebBuild } from './utils';

export async function createBabelrcForWorkspaceLibs(host: Tree) {
  const projects = getProjects(host);
  const graph = reverse(createProjectGraph(undefined, undefined, undefined));

  for (const [name, p] of projects.entries()) {
    if (!hasDependentAppUsingWebBuild(name, graph, projects)) {
      continue;
    }

    const babelrcPath = `${p.root}/.babelrc`;
    if (p.projectType === 'library' && !host.exists(babelrcPath)) {
      // Library is included in applications that require .babelrc to
      // exist and contain '@nrwl/web/babel' preset.
      host.write(
        babelrcPath,
        JSON.stringify({ presets: ['@nrwl/web/babel'] }, null, 2)
      );
    }
  }

  await formatFiles(host);
}

export default createBabelrcForWorkspaceLibs;
