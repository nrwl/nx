import {
  formatFiles,
  getProjects,
  joinPathFragments,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { SwcExecutorOptions } from '../../utils/schema';
import { tsquery } from '@phenomnomnominal/tsquery';
import type { TemplateSpan } from 'typescript';

export default async function (tree: Tree) {
  let changesMade = false;
  const projects = getProjects(tree);

  forEachExecutorOptions(
    tree,
    '@nrwl/js:swc',
    (_, projectName, target, configurationName) => {
      const projectConfiguration = projects.get(projectName);
      const executorOptions: SwcExecutorOptions = configurationName
        ? projectConfiguration.targets[target].configurations[configurationName]
        : projectConfiguration.targets[target].options;
      // if the project uses a custom path to swcrc file
      // and only if it's the default name
      if (
        executorOptions.swcrc &&
        executorOptions.swcrc.includes('.lib.swcrc')
      ) {
        const newSwcrc = executorOptions.swcrc.replace('.lib.swcrc', '.swcrc');
        // rename the swcrc file first
        tree.rename(executorOptions.swcrc, newSwcrc);
        // then update the executor options
        executorOptions.swcrc = newSwcrc;
        changesMade = true;
      }

      const libSwcrcPath =
        joinPathFragments(projectConfiguration.root, '.lib.swcrc') ||
        joinPathFragments(projectConfiguration.sourceRoot, '.lib.swcrc');
      const isLibSwcrcExist = tree.exists(libSwcrcPath);

      if (isLibSwcrcExist) {
        tree.rename(libSwcrcPath, libSwcrcPath.replace('.lib.swcrc', '.swcrc'));
        changesMade = true;
      }

      updateProjectConfiguration(tree, projectName, projectConfiguration);
    }
  );

  forEachExecutorOptions(
    tree,
    '@nrwl/jest:jest',
    (_, projectName, target, configurationName) => {
      const projectConfiguration = projects.get(projectName);
      const executorOptions = configurationName
        ? projectConfiguration.targets[target].configurations[configurationName]
        : projectConfiguration.targets[target].options;

      const isJestConfigExist =
        executorOptions.jestConfig && tree.exists(executorOptions.jestConfig);

      if (isJestConfigExist) {
        const jestConfig = tree.read(executorOptions.jestConfig, 'utf-8');

        const jsonParseNodes = tsquery.query(
          jestConfig,
          ':matches(CallExpression:has(Identifier[name="JSON"]):has(Identifier[name="parse"]))'
        );

        if (jsonParseNodes.length) {
          // if we already assign false to swcrc, skip
          if (jestConfig.includes('.swcrc = false')) {
            return;
          }

          let updatedJestConfig = tsquery.replace(
            jestConfig,
            'CallExpression:has(Identifier[name="JSON"]):has(Identifier[name="parse"]) TemplateSpan',
            (templateSpan: TemplateSpan) => {
              if (templateSpan.literal.text === '/.lib.swcrc') {
                return templateSpan
                  .getFullText()
                  .replace('.lib.swcrc', '.swcrc');
              }
              return '';
            }
          );

          updatedJestConfig = tsquery.replace(
            updatedJestConfig,
            ':matches(ExportAssignment, BinaryExpression:has(Identifier[name="module"]):has(Identifier[name="exports"]))',
            (node) => {
              return `

// disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves.
// If we do not disable this, SWC Core will read .swcrc and won't transform our test files due to "exclude"
if (swcJestConfig.swcrc === undefined) {
  swcJestConfig.swcrc = false;
}

${node.getFullText()}
`;
            }
          );

          tree.write(executorOptions.jestConfig, updatedJestConfig);
          changesMade = true;
        }
      }
    }
  );

  if (changesMade) {
    await formatFiles(tree);
  }
}
