import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';

export default async function (tree: Tree) {
  const projects = getProjects(tree);
  projects.forEach((p) => {
    let shouldUpdate = false;

    Object.entries(p.targets).forEach(([name, config]) => {
      if (
        p.targets?.[name]?.executor === '@nrwl/webpack:webpack' &&
        p.targets?.[name]?.options.es2015Polyfills
      ) {
        delete p.targets?.[name]?.options.es2015Polyfills;
        shouldUpdate = true;
      }
    });

    if (shouldUpdate) {
      updateProjectConfiguration(tree, p.name, p);
    }
  });
}
