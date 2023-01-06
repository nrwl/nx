import * as esbuild from 'esbuild';
import * as path from 'path';
import { parse } from 'path';
import * as glob from 'fast-glob';
import { getClientEnvironment } from '../../../utils/environment-variables';
import {
  EsBuildExecutorOptions,
  NormalizedEsBuildExecutorOptions,
} from '../schema';
import { ExecutorContext } from 'nx/src/config/misc-interfaces';
import { joinPathFragments } from 'nx/src/utils/path';
import { readJsonFile } from 'nx/src/utils/fileutils';

const ESM_FILE_EXTENSION = '.js';
const CJS_FILE_EXTENSION = '.cjs';

export function buildEsbuildOptions(
  format: 'cjs' | 'esm',
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
): esbuild.BuildOptions {
  const esbuildOptions: esbuild.BuildOptions = {
    ...options.esbuildOptions,
    entryNames:
      options.outputHashing === 'all' ? '[dir]/[name].[hash]' : '[dir]/[name]',
    bundle: options.bundle,
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

  if (options.singleEntry && options.bundle) {
    esbuildOptions.outfile = getOutfile(format, options, context);
  } else {
    esbuildOptions.outdir = options.outputPath;
  }

  const entryPoints = options.additionalEntryPoints
    ? [options.main, ...options.additionalEntryPoints]
    : [options.main];
  if (!options.bundle) {
    const projectRoot =
      context.projectsConfigurations.projects[context.projectName].root;
    const tsconfig = readJsonFile(path.join(context.root, options.tsConfig));
    const matchedFiles = glob
      .sync(tsconfig.include ?? [], {
        cwd: projectRoot,
        ignore: (tsconfig.exclude ?? []).concat([options.main]),
      })
      .map((f) => path.join(projectRoot, f))
      .filter((f) => !entryPoints.includes(f));
    entryPoints.push(...matchedFiles);
  }
  esbuildOptions.entryPoints = entryPoints;

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

export function getOutfile(
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
