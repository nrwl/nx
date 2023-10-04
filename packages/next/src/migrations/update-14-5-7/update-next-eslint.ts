import { formatFiles, getProjects, Tree, updateJson } from '@nx/devkit';

export async function updateNextEslint(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    if (project.targets?.build?.executor !== '@nrwl/next:build') return;

    const eslintPath = `${project.root}/.eslintrc.json`;

    if (!host.exists(eslintPath)) return;

    updateJson(host, eslintPath, (eslintConfig) => {
      const nextIgnorePattern = '.next/**/*';

      if (eslintConfig.ignorePatterns.indexOf(nextIgnorePattern) < 0) {
        eslintConfig.ignorePatterns = [
          ...eslintConfig.ignorePatterns,
          nextIgnorePattern,
        ];
      }
      return eslintConfig;
    });
  });
  await formatFiles(host);
}

export default updateNextEslint;
