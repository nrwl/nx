import { ExecutorContext, joinPathFragments, logger } from '@nrwl/devkit';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { gte } from 'semver';
import { CommonNxStorybookConfig } from './models';

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
    const { isWebpack5 } = require('@nrwl/web/src/webpack/entry');
    if (isWebpack5) {
      // check whether the current Storybook configuration has the webpack 5 builder enabled
      const storybookConfig = readFileSync(
        joinPathFragments(options.config.configFolder, 'main.js'),
        { encoding: 'utf8' }
      );

      if (!storybookConfig.includes(`builder: 'webpack5'`)) {
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
