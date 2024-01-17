import { formatFiles, getProjects, Tree } from '@nx/devkit';
import {
  isEslintConfigSupported,
  updateOverrideInLintConfig,
} from '@nx/eslint/src/generators/utils/eslint-file';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);
  projects.forEach((project) => {
    if (!isEslintConfigSupported(tree, project.root)) return;
    updateOverrideInLintConfig(
      tree,
      project.root,
      (o) =>
        o.rules?.['@next/next/no-html-link-for-pages'] &&
        o.files?.includes('**/*.*'),
      (o) => undefined
    );
  });

  await formatFiles(tree);
}
