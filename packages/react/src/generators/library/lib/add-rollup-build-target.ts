import { Tree } from 'nx/src/generators/tree';
import {
  addDependenciesToPackageJson,
  ensurePackage,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  stripIndents,
  updateProjectConfiguration,
} from '@nx/devkit';

import { maybeJs } from '../../../utils/maybe-js';
import {
  nxVersion,
  rollupPluginUrlVersion,
  svgrRollupVersion,
} from '../../../utils/versions';
import { NormalizedSchema } from '../schema';

export async function addRollupBuildTarget(
  host: Tree,
  options: NormalizedSchema
) {
  const tasks: GeneratorCallback[] = [];

  const { configurationGenerator } = ensurePackage<typeof import('@nx/rollup')>(
    '@nx/rollup',
    nxVersion
  );
  tasks.push(
    await configurationGenerator(host, {
      ...options,
      project: options.name,
      skipFormat: true,
    })
  );

  if (!options.skipPackageJson) {
    // These are used in `@nx/react/plugins/bundle-rollup`
    tasks.push(
      addDependenciesToPackageJson(
        host,
        {},
        {
          '@rollup/plugin-url': rollupPluginUrlVersion,
          '@svgr/rollup': svgrRollupVersion,
        }
      )
    );
  }

  const external: string[] = ['react', 'react-dom'];

  if (options.style === '@emotion/styled') {
    external.push('@emotion/react/jsx-runtime');
  } else {
    external.push('react/jsx-runtime');
  }

  const nxJson = readNxJson(host);
  const hasRollupPlugin = !!nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/rollup/plugin'
      : p.plugin === '@nx/rollup/plugin'
  );
  if (hasRollupPlugin) {
    // New behavior, using rollup config file and inferred target.
    host.write(
      joinPathFragments(options.projectRoot, 'rollup.config.js'),
      stripIndents`
      const { withNx } = require('@nx/rollup/with-nx');
      const url = require('@rollup/plugin-url');
      const svg = require('@svgr/rollup');
      
      module.exports = withNx({
        main: '${maybeJs(options, './src/index.ts')}',
        outputPath: '${joinPathFragments(
          offsetFromRoot(options.projectRoot),
          'dist',
          options.projectRoot
        )}',
        tsConfig: './tsconfig.lib.json',
        compiler: '${options.compiler ?? 'babel'}',
        external: ${JSON.stringify(external)},
        format: ['esm'],
        assets:[{ input: '.', output: '.', glob: 'README.md'}],
      }, {
        // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
        plugins: [
          svg({
            svgo: false,
            titleProp: true,
            ref: true,
          }),
          url({
            limit: 10000, // 10kB
          }),
        ],
      });
    `
    );
  } else {
    // Legacy behavior, there is a target in project.json using rollup executor.
    const { targets } = readProjectConfiguration(host, options.name);
    targets.build = {
      executor: '@nx/rollup:rollup',
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: joinPathFragments('dist', options.projectRoot),
        tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
        project: `${options.projectRoot}/package.json`,
        entryFile: maybeJs(options, `${options.projectRoot}/src/index.ts`),
        external,
        rollupConfig: `@nx/react/plugins/bundle-rollup`,
        compiler: options.compiler ?? 'babel',
        assets: [
          {
            glob: `${options.projectRoot}/README.md`,
            input: '.',
            output: '.',
          },
        ],
      },
    };

    updateProjectConfiguration(host, options.name, {
      root: options.projectRoot,
      sourceRoot: joinPathFragments(options.projectRoot, 'src'),
      projectType: 'library',
      tags: options.parsedTags,
      targets,
    });
  }

  return runTasksInSerial(...tasks);
}
