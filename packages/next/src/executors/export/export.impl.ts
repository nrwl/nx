import 'dotenv/config';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  workspaceLayout,
} from '@nx/devkit';
import exportApp from 'next/dist/export';
import { join, resolve } from 'path';
import {
  calculateProjectDependencies,
  DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';

import {
  NextBuildBuilderOptions,
  NextExportBuilderOptions,
} from '../../utils/types';

import nextTrace = require('next/dist/trace');
import { platform } from 'os';
import { execFileSync } from 'child_process';
import * as chalk from 'chalk';

// platform specific command name
const pmCmd = platform() === 'win32' ? `npx.cmd` : 'npx';

/**
 * @deprecated use output inside of your next.config.js
 * Example
 * const nextConfig = {
  nx: {
    svgr: false,
  },

  output: 'export'
};
 * Read https://nextjs.org/docs/pages/building-your-application/deploying/static-exports
 **/
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
  const projectRoot = context.projectGraph.nodes[context.projectName].data.root;

  // Taken from:
  // https://github.com/vercel/next.js/blob/ead56eaab68409e96c19f7d9139747bac1197aa9/packages/next/cli/next-export.ts#L13
  const nextExportCliSpan = nextTrace.trace('next-export-cli');

  await exportApp(
    projectRoot,
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
