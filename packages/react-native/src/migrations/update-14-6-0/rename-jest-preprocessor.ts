import {
  formatFiles,
  logger,
  ProjectConfiguration,
  readProjectConfiguration,
  stripIndents,
  Tree,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

/**
 * Rename reprocessor in jest to be from @nrwl/react-native
 * and remove the testRunner
 */
export default async function update(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nrwl/react-native:start',
    (options, projectName) => {
      const project = readProjectConfiguration(tree, projectName);
      mockSvgInJestConfig(tree, project);
    }
  );

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
