import {
  ExecutorContext,
  joinPathFragments,
  logger,
  parseTargetString,
  readTargetOptions,
} from '@nrwl/devkit';
import { TargetConfiguration, Workspaces } from 'nx/src/shared/workspace';
import { checkAndCleanWithSemver } from '@nrwl/workspace/src/utilities/version-utils';
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { gte, lt } from 'semver';
import {
  findOrCreateConfig,
  readCurrentWorkspaceStorybookVersionFromExecutor,
} from '../utils/utilities';
import { StorybookBuilderOptions } from './build-storybook/build-storybook.impl';
import { CommonNxStorybookConfig } from './models';
import { StorybookExecutorOptions } from './storybook/storybook.impl';

export interface NodePackage {
  name: string;
  version: string;
}

export function getStorybookFrameworkPath(uiFramework) {
  const serverOptionsPaths = {
    '@storybook/angular': '@storybook/angular/dist/ts3.9/server/options',
    '@storybook/react': '@storybook/react/dist/cjs/server/options',
    '@storybook/html': '@storybook/html/dist/cjs/server/options',
    '@storybook/vue': '@storybook/vue/dist/cjs/server/options',
    '@storybook/vue3': '@storybook/vue3/dist/cjs/server/options',
    '@storybook/web-components':
      '@storybook/web-components/dist/cjs/server/options',
    '@storybook/svelte': '@storybook/svelte/dist/cjs/server/options',
  };

  if (isStorybookV62onwards(uiFramework)) {
    return serverOptionsPaths[uiFramework];
  } else {
    return `${uiFramework}/dist/server/options`;
  }
}

function isStorybookV62onwards(uiFramework) {
  const storybookPackageVersion = require(join(
    uiFramework,
    'package.json'
  )).version;

  return gte(storybookPackageVersion, '6.2.0-rc.4');
}

// see: https://github.com/storybookjs/storybook/pull/12565
// TODO: this should really be passed as a param to the CLI rather than env
export function setStorybookAppProject(
  context: ExecutorContext,
  leadStorybookProject: string
) {
  let leadingProject: string;
  // for libs we check whether the build config should be fetched
  // from some app

  if (
    context.workspace.projects[context.projectName].projectType === 'library'
  ) {
    // we have a lib so let's try to see whether the app has
    // been set from which we want to get the build config
    if (leadStorybookProject) {
      leadingProject = leadStorybookProject;
    } else {
      // do nothing
      return;
    }
  } else {
    // ..for apps we just use the app target itself
    leadingProject = context.projectName;
  }

  process.env.STORYBOOK_ANGULAR_PROJECT = leadingProject;
}

export function runStorybookSetupCheck(options: CommonNxStorybookConfig) {
  webpackFinalPropertyCheck(options);
  reactWebpack5Check(options);
}

function reactWebpack5Check(options: CommonNxStorybookConfig) {
  if (options.uiFramework === '@storybook/react') {
    let storybookConfigFilePath = joinPathFragments(
      options.config.configFolder,
      'main.js'
    );

    if (!existsSync(storybookConfigFilePath)) {
      storybookConfigFilePath = joinPathFragments(
        options.config.configFolder,
        'main.ts'
      );
    }

    if (!existsSync(storybookConfigFilePath)) {
      // looks like there's no main config file, so skip
      return;
    }

    // check whether the current Storybook configuration has the webpack 5 builder enabled
    const storybookConfig = readFileSync(storybookConfigFilePath, {
      encoding: 'utf8',
    });

    if (
      !storybookConfig.match(/builder: ('webpack5'|"webpack5"|`webpack5`)/g)
    ) {
      // storybook needs to be upgraded to webpack 5
      logger.warn(`
It looks like you use Webpack 5 but your Storybook setup is not configured to leverage that
and thus falls back to Webpack 4.
Make sure you upgrade your Storybook config to use Webpack 5.

  - https://gist.github.com/shilman/8856ea1786dcd247139b47b270912324#upgrade
      
`);
    }
  }
}

function webpackFinalPropertyCheck(options: CommonNxStorybookConfig) {
  let placesToCheck = [
    {
      path: joinPathFragments('.storybook', 'webpack.config.js'),
      result: false,
    },
    {
      path: joinPathFragments(options.config.configFolder, 'webpack.config.js'),
      result: false,
    },
  ];

  placesToCheck = placesToCheck
    .map((entry) => {
      return {
        ...entry,
        result: existsSync(entry.path),
      };
    })
    .filter((x) => x.result === true);

  if (placesToCheck.length > 0) {
    logger.warn(
      `
  You have a webpack.config.js files in your Storybook configuration:
  ${placesToCheck.map((x) => `- "${x.path}"`).join('\n  ')}

  Consider switching to the "webpackFinal" property declared in "main.js" instead.
  ${
    options.uiFramework === '@storybook/react'
      ? 'https://nx.dev/latest/react/storybook/migrate-webpack-final'
      : 'https://nx.dev/latest/angular/storybook/migrate-webpack-final'
  }
    `
    );
  }
}

export function resolveCommonStorybookOptionMapper(
  builderOptions: CommonNxStorybookConfig,
  frameworkOptions: any,
  context: ExecutorContext
) {
  const storybookConfig = findOrCreateConfig(builderOptions.config, context);
  const storybookOptions = {
    workspaceRoot: context.root,
    configDir: storybookConfig,
    ...frameworkOptions,
    frameworkPresets: [...(frameworkOptions.frameworkPresets || [])],
    watch: false,
  };

  if (
    builderOptions.uiFramework === '@storybook/angular' &&
    // just for new 6.4 with Angular
    isStorybookGTE6_4()
  ) {
    let buildProjectName;
    let targetName = 'build'; // default
    let targetOptions = null;

    if (builderOptions.projectBuildConfig) {
      const targetString = normalizeTargetString(
        builderOptions.projectBuildConfig,
        targetName
      );

      const { project, target, configuration } =
        parseTargetString(targetString);

      // set the extracted target name
      targetName = target;
      buildProjectName = project;

      targetOptions = readTargetOptions(
        { project, target, configuration },
        context
      );

      storybookOptions.angularBrowserTarget = targetString;
    } else {
      const { storybookBuildTarget, storybookTarget, buildTarget } =
        findStorybookAndBuildTargets(
          context?.workspace?.projects?.[context.projectName]?.targets
        );

      throw new Error(
        `
        No projectBuildConfig was provided.
        
        To fix this, you can try one of the following options:
        
        1. You can run the ${
          context.targetName ? context.targetName : storybookTarget
        } executor by providing the projectBuildConfig flag as follows:
               
        nx ${context.targetName ? context.targetName : storybookTarget} ${
          context.projectName
        } --projectBuildConfig=${context.projectName}${
          !buildTarget && storybookBuildTarget ? `:${storybookBuildTarget}` : ''
        }

        2. In your project configuration, under the "${
          context.targetName ? context.targetName : storybookTarget
        }" target options, you can
        set the "projectBuildConfig" property to the name of the project of which you want to use
        the build configuration for Storybook.
        `
      );
    }

    const project = context.workspace.projects[buildProjectName];

    const angularDevkitCompatibleLogger = {
      ...logger,
      createChild() {
        return angularDevkitCompatibleLogger;
      },
    };

    // construct a builder object for Storybook
    storybookOptions.angularBuilderContext = {
      target: {
        ...project.targets[targetName],
        project: buildProjectName,
      },
      workspaceRoot: context.cwd,
      getProjectMetadata: () => {
        return project;
      },
      getTargetOptions: () => {
        return targetOptions;
      },
      logger: angularDevkitCompatibleLogger,
    };

    // Add watch to angularBuilderOptions for Storybook to merge configs correctly
    storybookOptions.angularBuilderOptions = {
      watch: true,
    };
  } else {
    // keep the backwards compatibility
    setStorybookAppProject(context, builderOptions.projectBuildConfig);
  }

  return storybookOptions;
}

function normalizeTargetString(
  appName: string,
  defaultTarget: string = 'build'
) {
  if (appName.includes(':')) {
    return appName;
  }
  return `${appName}:${defaultTarget}`;
}

function isStorybookGTE6_4() {
  const storybookVersion = readCurrentWorkspaceStorybookVersionFromExecutor();

  return gte(
    checkAndCleanWithSemver('@storybook/core', storybookVersion),
    '6.4.0-rc.1'
  );
}

export function isStorybookLT6() {
  const storybookVersion = readCurrentWorkspaceStorybookVersionFromExecutor();

  return lt(
    checkAndCleanWithSemver('@storybook/core', storybookVersion),
    '6.0.0'
  );
}

export function findStorybookAndBuildTargets(targets: {
  [targetName: string]: TargetConfiguration;
}): {
  storybookBuildTarget?: string;
  storybookTarget?: string;
  buildTarget?: string;
} {
  const returnObject: {
    storybookBuildTarget?: string;
    storybookTarget?: string;
    buildTarget?: string;
  } = {};
  Object.entries(targets).forEach(([target, targetConfig]) => {
    if (targetConfig.executor === '@nrwl/storybook:storybook') {
      returnObject.storybookTarget = target;
    }
    if (targetConfig.executor === '@nrwl/storybook:build') {
      returnObject.storybookBuildTarget = target;
    }
    if (
      targetConfig.executor === '@angular-devkit/build-angular:browser' ||
      targetConfig.executor === '@nrwl/angular:ng-packagr-lite'
    ) {
      returnObject.buildTarget = target;
    }
  });
  return returnObject;
}

export function normalizeAngularBuilderStylesOptions(
  builderOptions: StorybookBuilderOptions | StorybookExecutorOptions,
  uiFramework:
    | '@storybook/angular'
    | '@storybook/react'
    | '@storybook/html'
    | '@storybook/web-components'
    | '@storybook/vue'
    | '@storybook/vue3'
    | '@storybook/svelte'
    | '@storybook/react-native'
): StorybookBuilderOptions | StorybookExecutorOptions {
  if (uiFramework !== '@storybook/angular') {
    if (builderOptions.styles) {
      delete builderOptions.styles;
    }
    if (builderOptions.stylePreprocessorOptions) {
      delete builderOptions.stylePreprocessorOptions;
    }
  }
  return builderOptions;
}
