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
    outExtension: {
      '.js': getOutExtension(format, options),
    },
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

function getOutExtension(
  format: 'cjs' | 'esm',
  options: EsBuildExecutorOptions
): string {
  const userDefinedExt = options.esbuildOptions?.outExtension?.['.js'];
  // Allow users to change the output extensions from default CJS and ESM extensions.
  // CJS -> .js
  // ESM -> .mjs
  return userDefinedExt === '.js' && format === 'cjs'
    ? '.js'
    : userDefinedExt === '.mjs' && format === 'esm'
    ? '.mjs'
    : format === 'esm'
    ? ESM_FILE_EXTENSION
    : CJS_FILE_EXTENSION;
}

function getOutfile(
  format: 'cjs' | 'esm',
  options: EsBuildExecutorOptions,
  context: ExecutorContext
) {
  const ext = getOutExtension(format, options);
  const candidate = joinPathFragments(
    context.target.options.outputPath,
    options.outputFileName
  );
  const { dir, name } = parse(candidate);
  return `${dir}/${name}${ext}`;
}
