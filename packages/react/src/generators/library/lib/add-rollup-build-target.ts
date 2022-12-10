import { Tree } from 'nx/src/generators/tree';
import {
  ensurePackage,
  getWorkspaceLayout,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

import { maybeJs } from './maybe-js';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addRollupBuildTarget(
  host: Tree,
  options: NormalizedSchema
) {
  await ensurePackage(host, '@nrwl/rollup', nxVersion);
  const { rollupInitGenerator } = await import('@nrwl/rollup');

  const { targets } = readProjectConfiguration(host, options.name);

  const { libsDir } = getWorkspaceLayout(host);
  const external: string[] = [];

  if (options.style === '@emotion/styled') {
    external.push('@emotion/react/jsx-runtime');
  } else {
    external.push('react/jsx-runtime');
  }

  targets.build = {
    executor: '@nrwl/rollup:rollup',
    outputs: ['{options.outputPath}'],
    options: {
      outputPath:
        libsDir !== '.'
          ? `dist/${libsDir}/${options.projectDirectory}`
          : `dist/${options.projectDirectory}`,
      tsConfig: `${options.projectRoot}/tsconfig.lib.json`,
      project: `${options.projectRoot}/package.json`,
      entryFile: maybeJs(options, `${options.projectRoot}/src/index.ts`),
      external,
      rollupConfig: `@nrwl/react/plugins/bundle-rollup`,
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

  return rollupInitGenerator(host, options);
}
