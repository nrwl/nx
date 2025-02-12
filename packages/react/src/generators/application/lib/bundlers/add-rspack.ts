import {
  type Tree,
  ensurePackage,
  joinPathFragments,
  logger,
  addDependenciesToPackageJson,
  stripIndents,
} from '@nx/devkit';
import * as pc from 'picocolors';
import { babelLoaderVersion, nxVersion } from '../../../../utils/versions';
import { maybeJs } from '../../../../utils/maybe-js';
import { NormalizedSchema, Schema } from '../../schema';

export async function initRspack(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  const { rspackInitGenerator } = ensurePackage('@nx/rspack', nxVersion);
  const rspackInitTask = await rspackInitGenerator(tree, {
    ...options,
    addPlugin: false,
    skipFormat: true,
  });
  tasks.push(rspackInitTask);
}

export async function setupRspackConfiguration(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  tasks: any[]
) {
  const { configurationGenerator } = ensurePackage('@nx/rspack', nxVersion);
  const rspackTask = await configurationGenerator(tree, {
    project: options.projectName,
    main: joinPathFragments(
      options.appProjectRoot,
      maybeJs(
        {
          js: options.js,
          useJsx: true,
        },
        `src/main.tsx`
      )
    ),
    tsConfig: joinPathFragments(options.appProjectRoot, 'tsconfig.app.json'),
    target: 'web',
    newProject: true,
    framework: 'react',
  });
  tasks.push(rspackTask);
}

export function handleStyledJsxForRspack(
  tasks: any[],
  tree: Tree,
  options: NormalizedSchema<Schema>
) {
  logger.warn(
    `${pc.bold('styled-jsx')} is not supported by ${pc.bold(
      'Rspack'
    )}. We've added ${pc.bold(
      'babel-loader'
    )} to your project, but using babel will slow down your build.`
  );

  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      { 'babel-loader': babelLoaderVersion }
    )
  );

  tree.write(
    joinPathFragments(options.appProjectRoot, 'rspack.config.js'),
    stripIndents`
        const { composePlugins, withNx, withReact } = require('@nx/rspack');
        module.exports = composePlugins(withNx(), withReact(), (config) => {
          config.module.rules.push({
            test: /\\.[jt]sx$/i,
            use: [
              {
                loader: 'babel-loader',
                options: {
                  presets: ['@babel/preset-typescript'],
                  plugins: ['styled-jsx/babel'],
                },
              },
            ],
          });
          return config;
        });
        `
  );
}
