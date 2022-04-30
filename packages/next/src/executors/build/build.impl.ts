import withBundleAnalyzer from '@next/bundle-analyzer';
import {
  ExecutorContext,
  readCachedProjectGraph,
  workspaceLayout,
} from '@nrwl/devkit';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { directoryExists } from '@nrwl/workspace/src/utilities/fileutils';
import 'dotenv/config';
import { copySync, mkdir } from 'fs-extra';
import build from 'next/dist/build';
import { join, resolve } from 'path';
import { prepareConfig } from '../../utils/config';
import { importConstants } from '../../utils/require-shim';
import { NextBuildBuilderOptions } from '../../utils/types';
import { checkPublicDirectory } from './lib/check-project';
import { createNextConfigFile } from './lib/create-next-config-file';
import { createPackageJson } from './lib/create-package-json';

const { PHASE_PRODUCTION_BUILD } = importConstants();

export default async function buildExecutor(
  options: NextBuildBuilderOptions,
  context: ExecutorContext
) {
  // Cast to any to overwrite NODE_ENV
  (process.env as any).NODE_ENV ||= 'production';

  let dependencies: DependentBuildableProjectNode[] = [];
  const root = resolve(context.root, options.root);
  const libsDir = join(context.root, workspaceLayout().libsDir);

  checkPublicDirectory(root);

  if (!options.buildLibsFromSource && context.targetName) {
    const result = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.root,
      context.projectName,
      context.targetName,
      context.configurationName
    );
    dependencies = result.dependencies;
  }

  const config = withBundleAnalyzer({
    enabled: options.analyze ?? false,
  })(
    await prepareConfig(
      PHASE_PRODUCTION_BUILD,
      options,
      context,
      dependencies,
      libsDir
    )
  );

  await build(root, config as any);

  if (!directoryExists(options.outputPath)) {
    mkdir(options.outputPath);
  }

  await createPackageJson(options, context);
  createNextConfigFile(options, context);

  copySync(join(root, 'public'), join(options.outputPath, 'public'));

  return { success: true };
}
