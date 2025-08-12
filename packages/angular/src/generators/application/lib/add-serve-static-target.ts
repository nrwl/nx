import {
  addDependenciesToPackageJson,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import type { NormalizedSchema } from './normalized-schema';

export function addServeStaticTarget(
  tree: Tree,
  options: NormalizedSchema,
  port: number
) {
  addFileServerTarget(tree, options, 'serve-static', port);
}

function addFileServerTarget(
  tree: Tree,
  options: NormalizedSchema,
  targetName: string,
  e2ePort: number
) {
  if (!options.skipPackageJson) {
    addDependenciesToPackageJson(tree, {}, { '@nx/web': nxVersion });
  }

  const isUsingApplicationBuilder = options.bundler === 'esbuild';

  const projectConfig = readProjectConfiguration(tree, options.name);
  projectConfig.targets[targetName] = {
    continuous: true,
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.name}:build`,
      port: e2ePort,
      staticFilePath: isUsingApplicationBuilder
        ? joinPathFragments(options.outputPath, 'browser')
        : undefined,
      spa: true,
    },
  };
  updateProjectConfiguration(tree, options.name, projectConfig);
}
