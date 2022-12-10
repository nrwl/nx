import * as esbuild from 'esbuild';
import { getClientEnvironment } from '../../../utils/environment-variables';
import {
  EsBuildExecutorOptions,
  NormalizedEsBuildExecutorOptions,
} from '../schema';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { joinPathFragments } from 'nx/src/utils/path';
import { parse } from 'path';

const ESM_FILE_EXTENSION = '.js';
const CJS_FILE_EXTENSION = '.cjs';

export function buildEsbuildOptions(
  format: 'cjs' | 'esm',
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
): esbuild.BuildOptions {
  const esbuildOptions: esbuild.BuildOptions = {
    ...options.esbuildOptions,
    entryPoints: options.additionalEntryPoints
      ? [options.main, ...options.additionalEntryPoints]
      : [options.main],
    entryNames:
      options.outputHashing === 'all' ? '[dir]/[name].[hash]' : '[dir]/[name]',
    bundle: true, // TODO(jack): support non-bundled builds
    external: options.external,
    minify: options.minify,
    platform: options.platform,
    target: options.target,
    metafile: options.metafile,
    tsconfig: options.tsConfig,
    format,
    outExtension: { '.js': getOutExtension(format) },
  };

  if (options.platform === 'browser') {
    esbuildOptions.define = getClientEnvironment();
  }

  if (options.singleEntry) {
    esbuildOptions.outfile = getOutfile(format, options, context);
  } else {
    esbuildOptions.outdir = options.outputPath;
  }

  return esbuildOptions;
}

function getOutExtension(format: 'cjs' | 'esm') {
  return format === 'esm' ? ESM_FILE_EXTENSION : CJS_FILE_EXTENSION;
}

function getOutfile(
  format: 'cjs' | 'esm',
  options: EsBuildExecutorOptions,
  context: ExecutorContext
) {
  const candidate = joinPathFragments(
    context.target.options.outputPath,
    options.outputFileName
  );
  const ext = getOutExtension(format);
  const { dir, name } = parse(candidate);
  return `${dir}/${name}${ext}`;
}
