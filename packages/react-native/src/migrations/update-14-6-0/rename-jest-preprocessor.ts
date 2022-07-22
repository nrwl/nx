import {
  Tree,
  formatFiles,
  getProjects,
  ProjectConfiguration,
  logger,
  stripIndents,
} from '@nrwl/devkit';

/**
 * Rename reprocessor in jest to be from @nrwl/react-native
 * and remove the testRunner
 */
export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  projects.forEach((project) => {
    if (project.targets?.start?.executor !== '@nrwl/react-native:start') return;

    mockSvgInJestConfig(tree, project);
  });

  await formatFiles(tree);
}

function mockSvgInJestConfig(host: Tree, project: ProjectConfiguration) {
  const jestConfigPath = project.targets?.test?.options?.jestConfig;
  if (!jestConfigPath || !host.exists(jestConfigPath)) return;
  try {
    const contents = host.read(jestConfigPath, 'utf-8');
    if (contents.includes('@nrwl/react-native/plugins/jest/preprocessor.js'))
      return;
    host.write(
      jestConfigPath,
      contents
        .replace(
          'react-native/jest/preprocessor.js',
          '@nrwl/react-native/plugins/jest/preprocessor.js'
        )
        .replace(`testRunner: 'jest-jasmine2',\n`, '')
    );
  } catch {
    logger.error(
      stripIndents`Unable to update ${jestConfigPath} for project ${project.root}.`
    );
  }
}
