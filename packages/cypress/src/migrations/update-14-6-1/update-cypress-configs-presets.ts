import {
  logger,
  readProjectConfiguration,
  stripIndents,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { installedCypressVersion } from '../../utils/cypress-version';
import { findBuildConfig } from '../../utils/find-target-options';

export async function updateCypressConfigsPresets(tree: Tree) {
  if (installedCypressVersion() < 10) {
    return;
  }

  const projectsWithoutDevServerTarget = new Set<string>();
  const updateTasks = [];
  forEachExecutorOptions<CypressExecutorOptions>(
    tree,
    '@nrwl/cypress:cypress',
    (options, projectName, targetName, configName) => {
      if (options.cypressConfig && tree.exists(options.cypressConfig)) {
        updatePreset(tree, options, targetName);
      }

      const projectConfig = readProjectConfiguration(tree, projectName);
      const testingType =
        options.testingType ||
        projectConfig.targets[targetName]?.options?.testingType;
      const devServerTarget =
        options.devServerTarget ||
        projectConfig.targets[targetName]?.options?.devServerTarget;

      if (!devServerTarget && testingType === 'component') {
        updateTasks.push(
          addBuildTargetToConfig(
            tree,
            projectName,
            targetName,
            configName
          ).then((didUpdate) => {
            if (!didUpdate) {
              projectsWithoutDevServerTarget.add(projectName);
            }
          })
        );
      }
    }
  );

  if (updateTasks.length > 0) {
    cacheComponentTestTarget(tree);
  }

  await Promise.all(updateTasks);

  if (projectsWithoutDevServerTarget.size > 0) {
    logger.warn(
      `Unable to find a build target to add to the component testing target in the following projects:`
    );
    logger.warn(`- ${Array.from(projectsWithoutDevServerTarget).join('\n- ')}`);
    logger.warn(stripIndents`
You can manually add the 'devServerTarget' option to the 
component testing target to specify the build target to use.
The build configuration should be using @nrwl/web:webpack as the executor. 
Usually this is a React app in your workspace. 
Component testing will fallback to a default configuration if one isn't provided, 
but might require modifications if your projects are more complex.
    `);
  }
}

function updatePreset(
  tree: Tree,
  options: CypressExecutorOptions,
  targetName: string | undefined
) {
  let contents = tsquery.replace(
    tree.read(options.cypressConfig, 'utf-8'),
    'CallExpression',
    (node: ts.CallExpression) => {
      // technically someone could have both component and e2e in the same project.
      const expression = node.expression.getText();
      if (expression === 'nxE2EPreset') {
        return 'nxE2EPreset(__filename)';
      } else if (expression === 'nxE2EStorybookPreset') {
        return 'nxE2EStorybookPreset(__filename)';
      } else if (node.expression.getText() === 'nxComponentTestingPreset') {
        return targetName && targetName !== 'component-test' // the default
          ? `nxComponentTestingPreset(__filename, { ctTargetName: '${targetName}' })`
          : 'nxComponentTestingPreset(__filename)';
      }
      return;
    }
  );

  tree.write(options.cypressConfig, contents);
}

async function addBuildTargetToConfig(
  tree: Tree,
  projectName: string,
  targetName: string,
  configName?: string
): Promise<boolean> {
  const projectWithBuild = await findBuildConfig(tree, {
    project: projectName,
    validExecutorNames: new Set(['@nrwl/web:webpack']),
    skipGetOptions: true,
  });
  // didn't find the config so can't update. consumer should collect list of them and display a warning at the end
  // no reason to fail since the preset will fallback to a default config so should still keep working.
  if (!projectWithBuild?.target) {
    return false;
  }

  const projectConfig = readProjectConfiguration(tree, projectName);
  // if using a custom config and the devServerTarget default args
  // has a different target, then add it to the custom target config
  // otherwise add it to the default options
  if (
    configName &&
    projectWithBuild.target !==
      projectConfig.targets[targetName]?.options?.devServerTarget
  ) {
    projectConfig.targets[targetName].configurations[configName] = {
      ...projectConfig.targets[targetName].configurations[configName],
      devServerTarget: projectWithBuild.target,
      skipServe: true,
    };
  } else {
    projectConfig.targets[targetName].options = {
      ...projectConfig.targets[targetName].options,
      devServerTarget: projectWithBuild.target,
      skipServe: true,
    };
  }

  updateProjectConfiguration(tree, projectName, projectConfig);
  return true;
}

function cacheComponentTestTarget(tree: Tree) {
  updateJson(tree, 'nx.json', (json) => ({
    ...json,
    tasksRunnerOptions: {
      ...json.tasksRunnerOptions,
      default: {
        ...json.tasksRunnerOptions?.default,
        options: {
          ...json.tasksRunnerOptions?.default?.options,
          cacheableOperations: Array.from(
            new Set([
              ...(json.tasksRunnerOptions?.default?.options
                ?.cacheableOperations ?? []),
              'component-test',
            ])
          ),
        },
      },
    },
  }));
}

export default updateCypressConfigsPresets;
