import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
  runExecutor,
} from '@nrwl/devkit';
import exportApp from 'next/dist/export';
import { PHASE_EXPORT } from 'next/dist/next-server/lib/constants';
import { resolve } from 'path';
import { prepareConfig } from '../../utils/config';
import {
  NextBuildBuilderOptions,
  NextExportBuilderOptions,
} from '../../utils/types';

try {
  require('dotenv').config();
} catch (e) {}

export default async function exportExecutor(
  options: NextExportBuilderOptions,
  context: ExecutorContext
) {
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
  const config = await prepareConfig(PHASE_EXPORT, buildOptions, context);

  await exportApp(
    root,
    {
      statusMessage: 'Exporting',
      silent: options.silent,
      threads: options.threads,
      outdir: `${buildOptions.outputPath}/exported`,
    } as any,
    config
  );

  return { success: true };
}
