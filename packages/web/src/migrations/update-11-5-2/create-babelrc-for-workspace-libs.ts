import { formatFiles, getProjects, Tree, writeJson } from '@nrwl/devkit';
import { createProjectGraphAsync, reverse } from '@nrwl/devkit';
import { hasDependentAppUsingWebBuild } from './utils';

export async function createBabelrcForWorkspaceLibs(host: Tree) {
  const projects = getProjects(host);
  const graph = reverse(await createProjectGraphAsync());

  for (const [name, p] of projects.entries()) {
    if (!hasDependentAppUsingWebBuild(name, graph, projects)) {
      continue;
    }

    const babelrcPath = `${p.root}/.babelrc`;
    if (p.projectType === 'library' && !host.exists(babelrcPath)) {
      // Library is included in applications that require .babelrc to
      // exist and contain '@nrwl/web/babel' preset.
      writeJson(host, babelrcPath, { presets: ['@nrwl/web/babel'] });
    }
  }

  await formatFiles(host);
}

export default createBabelrcForWorkspaceLibs;
