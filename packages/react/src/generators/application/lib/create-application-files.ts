import {
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
  toJS,
  Tree,
  writeJson,
} from '@nx/devkit';
import { WithNxOptions } from '@nx/webpack';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { join } from 'path';
import { createTsConfig } from '../../../utils/create-ts-config';
import { getInSourceVitestTestsTemplate } from '../../../utils/get-in-source-vitest-tests-template';
import { maybeJs } from '../../../utils/maybe-js';
import { WithReactOptions } from '../../../../plugins/with-react';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { NormalizedSchema } from '../schema';
import { getAppTests } from './get-app-tests';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  let styleSolutionSpecificAppFiles: string;
  if (options.styledModule && options.style !== 'styled-jsx') {
    styleSolutionSpecificAppFiles = '../files/style-styled-module';
  } else if (options.style === 'styled-jsx') {
    styleSolutionSpecificAppFiles = '../files/style-styled-jsx';
  } else if (options.style === 'none') {
    styleSolutionSpecificAppFiles = '../files/style-none';
  } else if (options.globalCss) {
    styleSolutionSpecificAppFiles = '../files/style-global-css';
  } else {
    styleSolutionSpecificAppFiles = '../files/style-css-module';
  }

  const relativePathToRootTsConfig = getRelativePathToRootTsConfig(
    host,
    options.appProjectRoot
  );
  const appTests = getAppTests(options);
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
    appTests,
    inSourceVitestTests: getInSourceVitestTestsTemplate(appTests),
  };

  if (options.bundler === 'vite') {
    generateFiles(
      host,
      join(__dirname, '../files/base-vite'),
      options.appProjectRoot,
      templateVariables
    );
  } else if (options.bundler === 'webpack') {
    generateFiles(
      host,
      join(__dirname, '../files/base-webpack'),
      options.appProjectRoot,
      {
        ...templateVariables,
        webpackPluginOptions: hasWebpackPlugin(host)
          ? createNxWebpackPluginOptions(options)
          : null,
      }
    );
    if (options.compiler === 'babel') {
      writeJson(host, `${options.appProjectRoot}/.babelrc`, {
        presets: [
          [
            '@nx/react/babel',
            {
              runtime: 'automatic',
              importSource:
                options.style === '@emotion/styled'
                  ? '@emotion/react'
                  : undefined,
            },
          ],
        ],
        plugins: [
          options.style === 'styled-components'
            ? ['styled-components', { pure: true, ssr: true }]
            : undefined,
          options.style === 'styled-jsx' ? 'styled-jsx/babel' : undefined,
          options.style === '@emotion/styled'
            ? '@emotion/babel-plugin'
            : undefined,
        ].filter(Boolean),
      });
    } else if (options.compiler === 'swc') {
      const swcrc: any = {
        jsc: {
          target: 'es2016',
        },
      };
      if (options.style === 'styled-components') {
        swcrc.jsc.experimental = {
          plugins: [
            [
              '@swc/plugin-styled-components',
              {
                displayName: true,
                ssr: true,
              },
            ],
          ],
        };
      } else if (options.style === '@emotion/styled') {
        swcrc.jsc.experimental = {
          plugins: [['@swc/plugin-emotion', {}]],
        };
      } else if (options.style === 'styled-jsx') {
        swcrc.jsc.experimental = {
          plugins: [['@swc/plugin-styled-jsx', {}]],
        };
      }
      writeJson(host, `${options.appProjectRoot}/.swcrc`, swcrc);
    }
  } else if (options.bundler === 'rspack') {
    generateFiles(
      host,
      join(__dirname, '../files/base-rspack'),
      options.appProjectRoot,
      templateVariables
    );
  }

  if (
    options.unitTestRunner === 'none' ||
    (options.unitTestRunner === 'vitest' && options.inSourceTests == true)
  ) {
    host.delete(
      `${options.appProjectRoot}/src/app/${options.fileName}.spec.tsx`
    );
  }

  if (!options.minimal) {
    generateFiles(
      host,
      join(__dirname, '../files/nx-welcome'),
      options.appProjectRoot,
      templateVariables
    );
  }

  generateFiles(
    host,
    join(__dirname, styleSolutionSpecificAppFiles),
    options.appProjectRoot,
    templateVariables
  );

  if (options.js) {
    toJS(host);
  }

  createTsConfig(
    host,
    options.appProjectRoot,
    'app',
    options,
    relativePathToRootTsConfig
  );
}

function createNxWebpackPluginOptions(
  options: NormalizedSchema
): WithNxOptions & WithReactOptions {
  return {
    target: 'web',
    compiler: options.compiler ?? 'babel',
    outputPath: joinPathFragments(
      'dist',
      options.appProjectRoot != '.'
        ? options.appProjectRoot
        : options.projectName
    ),
    index: './src/index.html',
    baseHref: '/',
    main: maybeJs(options, `./src/main.tsx`),
    tsConfig: './tsconfig.app.json',
    assets: ['./src/favicon.ico', './src/assets'],
    styles:
      options.styledModule || !options.hasStyles
        ? []
        : [`./src/styles.${options.style}`],
  };
}
