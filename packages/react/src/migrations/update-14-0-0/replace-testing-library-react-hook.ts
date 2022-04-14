import {
  visitNotIgnoredFiles,
  Tree,
  getProjects,
  removeDependenciesFromPackageJson,
} from '@nrwl/devkit';

export async function update(tree: Tree) {
  const projects = getProjects(tree);
  projects.forEach((config) => {
    if (config.targets.test?.executor !== '@nrwl/jest:jest') return;

    visitNotIgnoredFiles(tree, config.sourceRoot, (file) => {
      if (!file.endsWith('.spec.ts')) return;

      const content = tree.read(file).toString();
      if (content.includes('@testing-library/react-hook')) {
        tree.write(
          file,
          content.replace(
            /@testing-library\/react-hook/g,
            '@testing-library/react'
          )
        );
      }
    });
  });

  removeDependenciesFromPackageJson(
    tree,
    ['@testing-library/react-hooks'],
    ['@testing-library/react-hooks']
  );
}

export default update;
