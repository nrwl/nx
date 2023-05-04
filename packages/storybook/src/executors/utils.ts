// TODO(katerina): Remove Nx17 - DELETE whole file

import { joinPathFragments, logger } from '@nx/devkit';
import { findNodes } from '@nx/js';
import 'dotenv/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { gte } from 'semver';
import ts = require('typescript');
import { CommonNxStorybookConfig } from '../utils/models';
import { CLIOptions } from '@storybook/types';

export function getStorybookFrameworkPath(uiFramework) {
  const serverOptionsPaths = {
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

function isStorybookV62onwards(uiFramework: string) {
  try {
    const storybookPackageVersion = require(join(
      uiFramework,
      'package.json'
    )).version;
    return gte(storybookPackageVersion, '6.2.0-rc.4');
  } catch (e) {
    try {
      const storybookPackageVersion = require(join(
        '@storybook/core-server',
        'package.json'
      )).version;
      return gte(storybookPackageVersion, '6.2.0-rc.4');
    } catch (e) {
      throw new Error(
        `Error: ${e}

        It looks like you don\'t have Storybook installed.
        Please run the @nx/storybook:configuration generator,
        or run "npm/yarn" again to install your dependencies.`
      );
    }
  }
}

export function runStorybookSetupCheck(
  options: CLIOptions & CommonNxStorybookConfig
) {
  webpackFinalPropertyCheck(options);
  reactWebpack5Check(options);
}

function reactWebpack5Check(options: CLIOptions & CommonNxStorybookConfig) {
  if (options.uiFramework === '@storybook/react') {
    const source = mainJsTsFileContent(options.configDir);
    const rootSource = mainJsTsFileContent('.storybook');
    // check whether the current Storybook configuration has the webpack 5 builder enabled
    if (
      builderIsWebpackButNotWebpack5(source) &&
      builderIsWebpackButNotWebpack5(rootSource)
    ) {
      logger.warn(`
      It looks like you use Webpack 5 but your Storybook setup is not configured to leverage that
      and thus falls back to Webpack 4.
      Make sure you upgrade your Storybook config to use Webpack 5.

        - https://gist.github.com/shilman/8856ea1786dcd247139b47b270912324#upgrade

      `);
    }
  }
}

function mainJsTsFileContent(configFolder: string): ts.SourceFile {
  let storybookConfigFilePath = joinPathFragments(configFolder, 'main.js');

  if (!existsSync(storybookConfigFilePath)) {
    storybookConfigFilePath = joinPathFragments(configFolder, 'main.ts');
  }

  if (!existsSync(storybookConfigFilePath)) {
    // looks like there's no main config file, so skip
    return;
  }

  const storybookConfig = readFileSync(storybookConfigFilePath, {
    encoding: 'utf8',
  });

  return ts.createSourceFile(
    storybookConfigFilePath,
    storybookConfig,
    ts.ScriptTarget.Latest,
    true
  );
}

function webpackFinalPropertyCheck(
  options: CLIOptions & CommonNxStorybookConfig
) {
  let placesToCheck = [
    {
      path: joinPathFragments('.storybook', 'webpack.config.js'),
      result: false,
    },
    {
      path: joinPathFragments(options.configDir, 'webpack.config.js'),
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

  Consider switching to the "webpackFinal" property declared in "main.js" (or "main.ts") instead.
  ${
    options.uiFramework === '@storybook/react'
      ? 'https://nx.dev/storybook/migrate-webpack-final-react'
      : 'https://nx.dev/storybook/migrate-webpack-final-angular'
  }
    `
    );
  }
}

export function builderIsWebpackButNotWebpack5(
  storybookConfig: ts.SourceFile
): boolean {
  const importArray = findNodes(storybookConfig, [
    ts.SyntaxKind.PropertyAssignment,
  ]);
  let builderIsWebpackNot5 = false;
  importArray.forEach((parent) => {
    const identifier = findNodes(parent, ts.SyntaxKind.Identifier);
    const sbBuilder = findNodes(parent, ts.SyntaxKind.StringLiteral);
    const builderText = sbBuilder?.[0]?.getText() ?? '';
    if (
      identifier?.[0]?.getText() === 'builder' &&
      builderText.includes('webpack') &&
      !builderText.includes('webpack5')
    ) {
      builderIsWebpackNot5 = true;
    }
  });

  return builderIsWebpackNot5;
}
