import {
  addDependenciesToPackageJson,
  ensurePackage,
  GeneratorCallback,
  joinPathFragments,
  offsetFromRoot,
  runTasksInSerial,
  Tree,
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
  options: NormalizedSchema & { format?: Array<'esm' | 'cjs'> },
  external: Set<String> = new Set(['react', 'react-dom'])
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
        },
        undefined,
        true
      )
    );
  }

  external.add('react/jsx-runtime');

  host.write(
    joinPathFragments(options.projectRoot, 'rollup.config.cjs'),
    `const { withNx } = require('@nx/rollup/with-nx');
const url = require('@rollup/plugin-url');
const svg = require('@svgr/rollup');

module.exports = withNx(
  {
    main: '${maybeJs(options, './src/index.ts')}',
    outputPath: '${
      options.isUsingTsSolutionConfig
        ? './dist'
        : joinPathFragments(
            offsetFromRoot(options.projectRoot),
            'dist',
            options.projectRoot
          )
    }',
    tsConfig: './tsconfig.lib.json',
    compiler: '${options.compiler ?? 'babel'}',
    external: ${JSON.stringify(Array.from(external))},
    format: ${JSON.stringify(options.format ?? ['esm'])},
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
  }
);
`
  );
  return runTasksInSerial(...tasks);
}
