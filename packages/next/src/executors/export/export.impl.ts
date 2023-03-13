import 'dotenv/config';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  workspaceLayout,
} from '@nrwl/devkit';
import exportApp from 'next/dist/export';
import { join, resolve } from 'path';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nrwl/js/src/utils/buildable-libs-utils';

import {
  NextBuildBuilderOptions,
  NextExportBuilderOptions,
} from '../../utils/types';
import { PHASE_EXPORT } from '../../utils/constants';
import nextTrace = require('next/dist/trace');
import { platform } from 'os';
import { execFileSync } from 'child_process';
import * as chalk from 'chalk';

// platform specific command name
const pmCmd = platform() === 'win32' ? `npx.cmd` : 'npx';

export default async function exportExecutor(
  options: NextExportBuilderOptions,
  context: ExecutorContext
) {
  let dependencies: DependentBuildableProjectNode[] = [];
  if (!options.buildLibsFromSource) {
    const result = calculateProjectDependencies(
      context.projectGraph,
      context.root,
      context.projectName,
      'build', // this should be generalized
      context.configurationName
    );
    dependencies = result.dependencies;
  }

  const libsDir = join(context.root, workspaceLayout().libsDir);
  const buildTarget = parseTargetString(
    options.buildTarget,
    context.projectGraph
  );

  try {
    const args = getBuildTargetCommand(options);
    execFileSync(pmCmd, args, {
      stdio: [0, 1, 2],
    });
  } catch {
    throw new Error(`Build target failed: ${chalk.bold(options.buildTarget)}`);
  }

  const buildOptions = readTargetOptions<NextBuildBuilderOptions>(
    buildTarget,
    context
  );
  const root = resolve(context.root, buildOptions.root);

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
    nextExportCliSpan
  );

  return { success: true };
}

function getBuildTargetCommand(options: NextExportBuilderOptions) {
  const cmd = ['nx', 'run', options.buildTarget];
  return cmd;
}
