import {
  formatFiles,
  getProjects,
  joinPathFragments,
  Tree,
} from '@nrwl/devkit';

export async function update(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    const nextConfigPath = joinPathFragments(project.root, 'next.config.js');
    const jestConfigPath = joinPathFragments(project.root, 'jest.config.js');
    const babelConfigPath = joinPathFragments(project.root, '.babelrc');

    if (
      !host.exists(nextConfigPath) ||
      !host.exists(jestConfigPath) ||
      !host.exists(babelConfigPath)
    )
      return;

    const content = host.read(jestConfigPath).toString();

    if (content.match(/:\s+'babel-jest'/)) {
      const updated = content.replace(
        /:\s+'babel-jest'/,
        `: ['babel-jest', { presets: ['@nrwl/next/babel'] }]`
      );
      host.write(jestConfigPath, updated);
    }

    // Deleting custom babel config enables SWC
    host.delete(babelConfigPath);
  });

  await formatFiles(host);
}

export default update;
