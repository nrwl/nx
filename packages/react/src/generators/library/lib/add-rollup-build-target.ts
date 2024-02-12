import { Tree } from 'nx/src/generators/tree';
import {
  GeneratorCallback,
  addDependenciesToPackageJson,
  ensurePackage,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
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

  const { targets } = readProjectConfiguration(host, options.name);

  const external: string[] = ['react', 'react-dom'];

  if (options.style === '@emotion/styled') {
    external.push('@emotion/react/jsx-runtime');
  } else {
    external.push('react/jsx-runtime');
  }

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

  return runTasksInSerial(...tasks);
}
