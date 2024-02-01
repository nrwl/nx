import { componentConfigurationGenerator as baseCyCTConfig } from '@nx/cypress';
import { NxComponentTestingOptions } from '@nx/cypress/plugins/cypress-preset';
import {
  addDefaultCTConfig,
  addMountDefinition,
  getProjectCypressConfigPath,
} from '@nx/cypress/src/utils/config';
import {
  findBuildConfig,
  FoundTarget,
} from '@nx/cypress/src/utils/find-target-options';
import {
  formatFiles,
  glob,
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { relative } from 'path';
import { componentTestGenerator } from '../component-test/component-test';
import {
  getComponentsInfo,
  getStandaloneComponentsInfo,
} from '../utils/storybook-ast/component-info';
import { getProjectEntryPoints } from '../utils/storybook-ast/entry-point';
import { getModuleFilePaths } from '../utils/storybook-ast/module-info';
import { CypressComponentConfigSchema } from './schema';

export function cypressComponentConfiguration(
  tree: Tree,
  options: CypressComponentConfigSchema
) {
  return cypressComponentConfigurationInternal(tree, {
    addPlugin: false,
    ...options,
  });
}

/**
 * This is for cypress built in component testing, if you want to test with
 * storybook + cypress then use the componentCypressGenerator instead.
 */
export async function cypressComponentConfigurationInternal(
  tree: Tree,
  options: CypressComponentConfigSchema
) {
  options.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  const projectConfig = readProjectConfiguration(tree, options.project);
  const installTask = await baseCyCTConfig(tree, {
    project: options.project,
    skipFormat: true,
    addPlugin: options.addPlugin,
  });

  await configureCypressCT(tree, options);
  await addFiles(tree, projectConfig, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}

async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigSchema
) {
  const componentFile = joinPathFragments(
    projectConfig.root,
    'cypress',
    'support',
    'component.ts'
  );
  const updatedCmpContents = await addMountDefinition(
    tree.read(componentFile, 'utf-8')
  );
  tree.write(
    componentFile,
    `import { mount } from 'cypress/angular';\n${updatedCmpContents}`
  );

  if (options.generateTests) {
    const entryPoints = getProjectEntryPoints(tree, options.project);

    const componentInfo = [];
    for (const entryPoint of entryPoints) {
      const moduleFilePaths = getModuleFilePaths(tree, entryPoint);
      componentInfo.push(
        ...getComponentsInfo(
          tree,
          entryPoint,
          moduleFilePaths,
          options.project
        ),
        ...getStandaloneComponentsInfo(tree, entryPoint)
      );
    }

    for (const info of componentInfo) {
      if (info === undefined) {
        continue;
      }
      const componentDirFromProjectRoot = relative(
        projectConfig.root,
        joinPathFragments(info.moduleFolderPath, info.path)
      );
      await componentTestGenerator(tree, {
        project: options.project,
        componentName: info.name,
        componentDir: componentDirFromProjectRoot,
        componentFileName: info.componentFileName,
        skipFormat: true,
      });
    }
  }
}

async function configureCypressCT(
  tree: Tree,
  options: CypressComponentConfigSchema
) {
  let found: FoundTarget = { target: options.buildTarget, config: undefined };

  if (!options.buildTarget) {
    found = await findBuildConfig(tree, {
      project: options.project,
      buildTarget: options.buildTarget,
      validExecutorNames: new Set<string>([
        '@nx/angular:webpack-browser',
        '@nrwl/angular:webpack-browser',
        '@angular-devkit/build-angular:browser',
      ]),
    });

    assertValidConfig(found?.config);
  }

  const ctConfigOptions: NxComponentTestingOptions = {};
  const projectConfig = readProjectConfiguration(tree, options.project);
  if (
    projectConfig.targets?.['component-test']?.executor ===
    '@nx/cypress:cypress'
  ) {
    projectConfig.targets['component-test'].options = {
      ...projectConfig.targets['component-test'].options,
      skipServe: true,
      devServerTarget: found.target,
    };
    updateProjectConfiguration(tree, options.project, projectConfig);
  } else {
    ctConfigOptions.buildTarget = found.target;
  }

  const cypressConfigPath = getProjectCypressConfigPath(
    tree,
    projectConfig.root
  );
  const updatedCyConfig = await addDefaultCTConfig(
    tree.read(cypressConfigPath, 'utf-8'),
    ctConfigOptions
  );
  tree.write(
    cypressConfigPath,
    `import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';\n${updatedCyConfig}`
  );
}

function assertValidConfig(config: unknown) {
  if (!config) {
    throw new Error(
      'Unable to find a valid build configuration. Try passing in a target for an Angular app. --build-target=<project>:<target>[:<configuration>]'
    );
  }
}

export default cypressComponentConfiguration;
