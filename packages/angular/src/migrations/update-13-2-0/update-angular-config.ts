import type { Tree } from '@nrwl/devkit';
import { getProjects, updateProjectConfiguration } from '@nrwl/devkit';

export default async function (tree: Tree) {
  const projects = getProjects(tree);
  for (const [projectName, project] of projects.entries()) {
    for (const [targetName, target] of Object.entries(project.targets)) {
      if (target.executor === '@nrwl/angular:webpack-server') {
        updateProjectConfiguration(tree, projectName, {
          ...project,
          targets: {
            ...project.targets,
            [targetName]: {
              ...target,
              options: {
                ...target.options,
                optimization: undefined,
                aot: undefined,
                progress: undefined,
                deployUrl: undefined,
                sourceMap: undefined,
                vendorChunk: undefined,
                commonChunk: undefined,
                baseHref: undefined,
                servePathDefaultWarning: undefined,
                hmrWarning: undefined,
                extractCss: undefined,
              },
            },
          },
        });
      } else if (target.executor === '@nrwl/angular:webpack-browser') {
        updateProjectConfiguration(tree, projectName, {
          ...project,
          [targetName]: {
            ...target,
            options: {
              ...target.options,
              extractCss: undefined,
            },
          },
        });
      }
    }
  }
}
