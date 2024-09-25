import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  targetToTargetString,
} from '@nx/devkit';
import exportApp from 'next/dist/export';
import {
  NextBuildBuilderOptions,
  NextExportBuilderOptions,
} from '../../utils/types';

import nextTrace = require('next/dist/trace');
import { platform } from 'os';
import { execFileSync } from 'child_process';
import * as pc from 'picocolors';
import { satisfies } from 'semver';

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
  const nextJsVersion = require('next/package.json').version;
  if (satisfies(nextJsVersion, '>=14.0.0')) {
    throw new Error(
      'The export command has been removed in Next.js 14. Please update your Next config to use the output property. Read more: https://nextjs.org/docs/pages/building-your-application/deploying/static-exports'
    );
  }
  // Returns { project: ProjectGraphNode; target: string; configuration?: string;}
  const buildTarget = parseTargetString(options.buildTarget, context);

  try {
    const buildTargetName = targetToTargetString(buildTarget);
    const args = getBuildTargetCommand(buildTargetName);
    execFileSync(pmCmd, args, {
      stdio: [0, 1, 2],
    });
  } catch {
    throw new Error(`Build target failed: ${pc.bold(options.buildTarget)}`);
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

function getBuildTargetCommand(buildTarget: string) {
  const cmd = ['nx', 'run', buildTarget];
  return cmd;
}
