import type { NxComponentTestingOptions } from '@nx/cypress/plugins/cypress-preset';
import type { FoundTarget } from '@nx/cypress/src/utils/find-target-options';
import {
  ensurePackage,
  formatFiles,
  GeneratorCallback,
  getDependencyVersionFromPackageJson,
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { relative } from 'path';
import { isZonelessApp } from '../../utils/zoneless';
import { nxVersion } from '../../utils/versions';
import { componentTestGenerator } from '../component-test/component-test';
import {
  getComponentsInfo,
  getStandaloneComponentsInfo,
} from '../utils/storybook-ast/component-info';
import { getProjectEntryPoints } from '../utils/storybook-ast/entry-point';
import { getModuleFilePaths } from '../utils/storybook-ast/module-info';
import { updateAppEditorTsConfigExcludedFiles } from '../utils/update-app-editor-tsconfig-excluded-files';
import { CypressComponentConfigSchema } from './schema';

const webpackExecutors = new Set<string>([
  '@nx/angular:webpack-browser',
  '@nrwl/angular:webpack-browser',
  '@angular-devkit/build-angular:browser',
]);

const esbuildExecutors = new Set<string>([
  '@angular/build:application',
  '@angular-devkit/build-angular:application',
  '@nx/angular:application',
  '@angular-devkit/build-angular:browser-esbuild',
  '@nx/angular:browser-esbuild',
]);

/**
 * This is for cypress built in component testing, if you want to test with
 * storybook + cypress then use the componentCypressGenerator instead.
 */
export async function cypressComponentConfiguration(
  tree: Tree,
  options: CypressComponentConfigSchema
): Promise<GeneratorCallback> {
  const projectConfig = readProjectConfiguration(tree, options.project);

  // Cypress Component Testing requires Zone.js
  let isZoneless: boolean;
  if (projectConfig.projectType === 'application') {
    // For applications, check the polyfills in the build target
    isZoneless = isZonelessApp(projectConfig);
  } else {
    // For libraries, check if zone.js is installed in the workspace
    isZoneless = getDependencyVersionFromPackageJson(tree, 'zone.js') === null;
  }

  if (isZoneless) {
    throw new Error(
      `Cypress Component Testing doesn't support Zoneless Angular projects yet. ` +
        `The project "${options.project}" is configured without Zone.js. ` +
        `See https://github.com/cypress-io/cypress/issues/31504.`
    );
  }

  const { componentConfigurationGenerator: baseCyCTConfig } = ensurePackage<
    typeof import('@nx/cypress')
  >('@nx/cypress', nxVersion);
  const tasks: GeneratorCallback[] = [];
  tasks.push(
    await baseCyCTConfig(tree, {
      project: options.project,
      skipFormat: true,
      addPlugin: false,
      addExplicitTargets: true,
      skipPackageJson: options.skipPackageJson,
    })
  );

  await configureCypressCT(tree, options);
  tasks.push(await addFiles(tree, projectConfig, options));

  if (projectConfig.projectType === 'application') {
    updateAppEditorTsConfigExcludedFiles(tree, projectConfig);
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

async function addFiles(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressComponentConfigSchema
): Promise<GeneratorCallback> {
  const componentFile = joinPathFragments(
    projectConfig.root,
    'cypress',
    'support',
    'component.ts'
  );
  const { addMountDefinition } = <
    typeof import('@nx/cypress/src/utils/config')
  >require('@nx/cypress/src/utils/config');
  const updatedCmpContents = await addMountDefinition(
    tree.read(componentFile, 'utf-8')
  );
  tree.write(
    componentFile,
    `import { mount } from 'cypress/angular';\n${updatedCmpContents}`
  );

  if (!options.generateTests) {
    return () => {};
  }

  const entryPoints = getProjectEntryPoints(tree, options.project);

  const componentInfo = [];
  for (const entryPoint of entryPoints) {
    const moduleFilePaths = getModuleFilePaths(tree, entryPoint);
    componentInfo.push(
      ...getComponentsInfo(tree, entryPoint, moduleFilePaths, options.project),
      ...getStandaloneComponentsInfo(tree, entryPoint)
    );
  }

  let ctTask: GeneratorCallback;
  for (const info of componentInfo) {
    if (info === undefined) {
      continue;
    }
    const componentDirFromProjectRoot = relative(
      projectConfig.root,
      joinPathFragments(info.moduleFolderPath, info.path)
    );

    const task = await componentTestGenerator(tree, {
      project: options.project,
      componentName: info.name,
      componentDir: componentDirFromProjectRoot,
      componentFileName: info.componentFileName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
    });

    // the ct generator only installs one dependency, which will only be installed
    // if !skipPackageJson and not already installed, so only the first run can
    // result in a generator callback that would actually install the dependency
    if (!ctTask) {
      ctTask = task;
    }
  }

  return ctTask ?? (() => {});
}

async function configureCypressCT(
  tree: Tree,
  options: CypressComponentConfigSchema
) {
  let found: FoundTarget = { target: options.buildTarget, config: undefined };

  if (!options.buildTarget) {
    const { findBuildConfig } = <
      typeof import('@nx/cypress/src/utils/find-target-options')
    >require('@nx/cypress/src/utils/find-target-options');
    found = await findBuildConfig(tree, {
      project: options.project,
      buildTarget: options.buildTarget,
      validExecutorNames: webpackExecutors,
    });

    if (!found?.config) {
      // Check if the project uses an esbuild-based executor
      const esbuildTarget = await findBuildConfig(tree, {
        project: options.project,
        validExecutorNames: esbuildExecutors,
        skipGetOptions: true,
      });

      if (esbuildTarget?.target) {
        const projectConfig = readProjectConfiguration(
          tree,
          esbuildTarget.target.split(':')[0]
        );
        const targetName = esbuildTarget.target.split(':')[1];
        const executor = projectConfig.targets?.[targetName]?.executor;

        throw new Error(
          `Cypress Component Testing for Angular requires a webpack-based build target, ` +
            `but the project "${options.project}" uses an esbuild-based executor (${executor}).\n\n` +
            `Cypress only supports webpack as the bundler for Angular component testing.`
        );
      }

      throw new Error(
        'Unable to find a valid build configuration. Try passing in a target for an Angular app (e.g. --build-target=<project>:<target>[:<configuration>]).'
      );
    }
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

  const { addDefaultCTConfig, getProjectCypressConfigPath } = <
    typeof import('@nx/cypress/src/utils/config')
  >require('@nx/cypress/src/utils/config');
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

export default cypressComponentConfiguration;
