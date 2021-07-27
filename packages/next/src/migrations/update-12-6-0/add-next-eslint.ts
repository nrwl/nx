import { formatFiles, getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function addNextEslint(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    if (project.targets?.build?.executor !== '@nrwl/next:build') return;

    const eslintPath = `${project.root}/.eslintrc.json`;
    if (!host.exists(eslintPath)) return;

    updateJson(host, eslintPath, (eslintConfig) => {
      if (!eslintConfig.extends) {
        eslintConfig.extends = [];
      }
      if (typeof eslintConfig.extends === 'string') {
        eslintConfig.extends = [eslintConfig.extends];
      }
      // add next.js configuration
      eslintConfig.extends.push(...['next', 'next/core-web-vitals']);
      // remove nx/react plugin, as it conflicts with the next.js one
      eslintConfig.extends = eslintConfig.extends.filter(
        (name) => name !== 'plugin:@nrwl/nx/react'
      );
      eslintConfig.extends.unshift('plugin:@nrwl/nx/react-typescript');
      if (!eslintConfig.env) {
        eslintConfig.env = {};
      }
      eslintConfig.env.jest = true;
      return eslintConfig;
    });
  });

  await formatFiles(host);
}

export default addNextEslint;
