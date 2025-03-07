import {
  generateFiles,
  joinPathFragments,
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
import {
  createNxCloudOnboardingURLForWelcomeApp,
  getNxCloudAppOnBoardingUrl,
} from 'nx/src/nx-cloud/utilities/onboarding';
import { hasRspackPlugin } from '../../../utils/has-rspack-plugin';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export async function createApplicationFiles(
  host: Tree,
  options: NormalizedSchema
) {
  let styleSolutionSpecificAppFiles: string;
  if (options.styledModule && options.style !== 'styled-jsx') {
    styleSolutionSpecificAppFiles = '../files/style-styled-module';
  } else if (options.style === 'styled-jsx') {
    styleSolutionSpecificAppFiles = '../files/style-styled-jsx';
  } else if (options.style === 'tailwind') {
    styleSolutionSpecificAppFiles = '../files/style-tailwind';
  } else if (options.style === 'none') {
    styleSolutionSpecificAppFiles = '../files/style-none';
  } else if (options.globalCss) {
    styleSolutionSpecificAppFiles = '../files/style-global-css';
  } else {
    styleSolutionSpecificAppFiles = '../files/style-css-module';
  }
  const hasStyleFile = ['scss', 'css', 'less'].includes(options.style);

  const onBoardingStatus = await createNxCloudOnboardingURLForWelcomeApp(
    host,
    options.nxCloudToken
  );

  const connectCloudUrl =
    onBoardingStatus === 'unclaimed' &&
    (await getNxCloudAppOnBoardingUrl(options.nxCloudToken));

  const relativePathToRootTsConfig = getRelativePathToRootTsConfig(
    host,
    options.appProjectRoot
  );
  const appTests = getAppTests(options);
  const templateVariables = {
    ...options.names,
    ...options,
    js: !!options.js, // Ensure this is defined in template
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
    appTests,
    inSourceVitestTests: getInSourceVitestTestsTemplate(appTests),
    style: options.style === 'tailwind' ? 'css' : options.style,
    hasStyleFile,
    isUsingTsSolutionSetup: isUsingTsSolutionSetup(host),
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
          ? createNxWebpackPluginOptions(
              options,
              templateVariables.offsetFromRoot
            )
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
      {
        ...templateVariables,
        rspackPluginOptions: hasRspackPlugin(host)
          ? createNxRspackPluginOptions(
              options,
              templateVariables.offsetFromRoot
            )
          : null,
      }
    );
  } else if (options.bundler === 'rsbuild') {
    generateFiles(
      host,
      join(__dirname, '../files/base-rsbuild'),
      options.appProjectRoot,
      {
        ...templateVariables,
      }
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
    const tutorialUrl = options.rootProject
      ? 'https://nx.dev/getting-started/tutorials/react-standalone-tutorial'
      : 'https://nx.dev/react-tutorial/1-code-generation?utm_source=nx-project';

    generateFiles(
      host,
      join(__dirname, '../files/nx-welcome', onBoardingStatus),
      options.appProjectRoot,
      { ...templateVariables, connectCloudUrl, tutorialUrl }
    );
  }

  generateFiles(
    host,
    join(__dirname, styleSolutionSpecificAppFiles),
    options.appProjectRoot,
    templateVariables
  );

  if (options.js) {
    toJS(host, {
      useJsx: options.bundler === 'vite' || options.bundler === 'rspack',
    });
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
  options: NormalizedSchema,
  rootOffset: string
): WithNxOptions & WithReactOptions {
  return {
    target: 'web',
    compiler: options.compiler ?? 'babel',
    outputPath: options.isUsingTsSolutionConfig
      ? 'dist'
      : joinPathFragments(
          rootOffset,
          'dist',
          options.appProjectRoot != '.'
            ? options.appProjectRoot
            : options.projectName
        ),
    index: './src/index.html',
    baseHref: '/',
    main: maybeJs(
      {
        js: options.js,
        useJsx: options.bundler === 'vite' || options.bundler === 'rspack',
      },
      `./src/main.tsx`
    ),
    tsConfig: './tsconfig.app.json',
    assets: ['./src/favicon.ico', './src/assets'],
    styles:
      options.styledModule || !options.hasStyles
        ? []
        : [
            `./src/styles.${
              options.style !== 'tailwind' ? options.style : 'css'
            }`,
          ],
  };
}

function createNxRspackPluginOptions(
  options: NormalizedSchema,
  rootOffset: string
): WithNxOptions & WithReactOptions {
  return {
    target: 'web',
    outputPath: options.isUsingTsSolutionConfig
      ? 'dist'
      : joinPathFragments(
          rootOffset,
          'dist',
          options.appProjectRoot != '.'
            ? options.appProjectRoot
            : options.projectName
        ),
    index: './src/index.html',
    baseHref: '/',
    main: maybeJs(
      {
        js: options.js,
        useJsx: true,
      },
      `./src/main.tsx`
    ),
    tsConfig: './tsconfig.app.json',
    assets: ['./src/favicon.ico', './src/assets'],
    styles:
      options.styledModule || !options.hasStyles
        ? []
        : [
            `./src/styles.${
              options.style !== 'tailwind' ? options.style : 'css'
            }`,
          ],
  };
}
