import 'dotenv/config';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nrwl/devkit';
import exportApp from 'next/dist/export';
import { join, resolve } from 'path';

import { prepareConfig } from '../../utils/config';
import {
  NextBuildBuilderOptions,
  NextExportBuilderOptions,
} from '../../utils/types';
import { readCachedProjectGraph } from '@nrwl/devkit';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { importConstants } from '../../utils/require-shim';
import { workspaceLayout } from '@nrwl/devkit';
import nextTrace = require('next/dist/trace');

const { PHASE_EXPORT } = importConstants();

export default async function exportExecutor(
  options: NextExportBuilderOptions,
  context: ExecutorContext
) {
  let dependencies: DependentBuildableProjectNode[] = [];
  if (!options.buildLibsFromSource) {
    const result = calculateProjectDependencies(
      readCachedProjectGraph(),
      context.root,
      context.projectName,
      'build', // this should be generalized
      context.configurationName
    );
    dependencies = result.dependencies;
  }

  const libsDir = join(context.root, workspaceLayout().libsDir);
  const buildTarget = parseTargetString(options.buildTarget);
  const build = await runExecutor(buildTarget, {}, context);

  for await (const result of build) {
    if (!result.success) {
      return result;
    }
  }

  const buildOptions = readTargetOptions<NextBuildBuilderOptions>(
    buildTarget,
    context
  );
  const root = resolve(context.root, buildOptions.root);
  const config = await prepareConfig(
    PHASE_EXPORT,
    buildOptions,
    context,
    dependencies,
    libsDir
  );

  // Taken from:
  // https://github.com/vercel/next.js/blob/ead56eaab68409e96c19f7d9139747bac1197aa9/packages/next/cli/next-export.ts#L13
  const nextExportCliSpan = nextTrace.trace('next-export-cli');

  await exportApp(
    root,
    {
      statusMessage: 'Exporting',
      silent: options.silent,
      threads: options.threads,
      outdir: `${buildOptions.outputPath}/exported`,
    } as any,
    nextExportCliSpan,
    config
  );

  return { success: true };
}
