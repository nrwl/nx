import * as esbuild from 'esbuild';
import * as path from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import {
  ExecutorContext,
  joinPathFragments,
  normalizePath,
  ProjectGraphProjectNode,
} from '@nx/devkit';

import { getClientEnvironment } from '../../../utils/environment-variables';
import { NormalizedEsBuildExecutorOptions } from '../schema';
import { getEntryPoints } from '../../../utils/get-entry-points';

const ESM_FILE_EXTENSION = '.js';
const CJS_FILE_EXTENSION = '.cjs';

export function buildEsbuildOptions(
  format: 'cjs' | 'esm',
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
): esbuild.BuildOptions {
  const outExtension = getOutExtension(format, options);

  const esbuildOptions: esbuild.BuildOptions = {
    ...options.userDefinedBuildOptions,
    entryNames:
      options.outputHashing === 'all' ? '[dir]/[name].[hash]' : '[dir]/[name]',
    bundle: options.bundle,
    // Cannot use external with bundle option
    external: options.bundle
      ? [
          ...(options.userDefinedBuildOptions?.external ?? []),
          ...options.external,
        ]
      : undefined,
    minify: options.minify,
    platform: options.platform,
    target: options.target,
    metafile: options.metafile,
    tsconfig: options.tsConfig,
    sourcemap:
      (options.sourcemap ?? options.userDefinedBuildOptions?.sourcemap) ||
      false,
    format,
    outExtension: {
      '.js': outExtension,
    },
  };

  if (options.platform === 'browser') {
    esbuildOptions.define = getClientEnvironment();
  }

  if (!esbuildOptions.outfile && !esbuildOptions.outdir) {
    if (options.singleEntry && options.bundle && !esbuildOptions.splitting) {
      esbuildOptions.outfile = getOutfile(format, options, context);
    } else {
      esbuildOptions.outdir = options.outputPath;
    }
  }

  const entryPoints = options.additionalEntryPoints
    ? [options.main, ...options.additionalEntryPoints]
    : [options.main];

  if (options.bundle) {
    esbuildOptions.entryPoints = entryPoints;
  } else if (options.platform === 'node' && format === 'cjs') {
    // When target platform Node and target format is CJS, then also transpile workspace libs used by the app.
    // Provide a `require` override in the main entry file so workspace libs can be loaded when running the app.
    const paths = getTsConfigCompilerPaths(context);
    const entryPointsFromProjects = getEntryPoints(
      context.projectName,
      context,
      {
        initialTsConfigFileName: options.tsConfig,
        initialEntryPoints: entryPoints,
        recursive: true,
      }
    );

    esbuildOptions.entryPoints = [
      // Write a main entry file that registers workspace libs and then calls the user-defined main.
      writeTmpEntryWithRequireOverrides(paths, outExtension, options, context),
      ...entryPointsFromProjects.map((f) => {
        /**
         * Maintain same directory structure as the workspace, so that other workspace libs may be used by the project.
         * dist
         * └── apps
         *     └── demo
         *         ├── apps
         *         │   └── demo
         *         │       └── src
         *         │           └── main.js (requires '@acme/utils' which is mapped to libs/utils/src/index.js)
         *         ├── libs
         *         │   └── utils
         *         │       └── src
         *         │           └── index.js
         *         └── main.js (entry with require overrides)
         */
        const { dir, name } = path.parse(f);
        return {
          in: f,
          out: path.join(dir, name),
        };
      }),
    ];
  } else {
    // Otherwise, just transpile the project source files. Any workspace lib will need to be published separately.
    esbuildOptions.entryPoints = getEntryPoints(context.projectName, context, {
      initialTsConfigFileName: options.tsConfig,
      initialEntryPoints: entryPoints,
      recursive: false,
    });
  }

  return esbuildOptions;
}

export function getOutExtension(
  format: 'cjs' | 'esm',
  options: NormalizedEsBuildExecutorOptions
): '.cjs' | '.mjs' | '.js' {
  const userDefinedExt = options.userDefinedBuildOptions?.outExtension?.['.js'];
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
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
) {
  const ext = getOutExtension(format, options);
  const candidate = joinPathFragments(
    context.target.options.outputPath,
    options.outputFileName
  );
  const { dir, name } = path.parse(candidate);
  return `${dir}/${name}${ext}`;
}

function writeTmpEntryWithRequireOverrides(
  paths: Record<string, string[]>,
  outExtension: '.cjs' | '.js' | '.mjs',
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
): { in: string; out: string } {
  const project = context.projectGraph?.nodes[context.projectName];
  // Write a temp main entry source that registers workspace libs.
  const tmpPath = path.join(context.root, 'tmp', project.name);
  mkdirSync(tmpPath, { recursive: true });

  const { name: mainFileName, dir: mainPathRelativeToDist } = path.parse(
    options.main
  );
  const mainWithRequireOverridesInPath = path.join(
    tmpPath,
    `main-with-require-overrides.js`
  );
  writeFileSync(
    mainWithRequireOverridesInPath,
    getRegisterFileContent(
      project,
      paths,
      `./${path.join(
        mainPathRelativeToDist,
        `${mainFileName}${outExtension}`
      )}`,
      outExtension
    )
  );

  let mainWithRequireOverridesOutPath: string;
  if (options.outputFileName) {
    mainWithRequireOverridesOutPath = path.parse(options.outputFileName).name;
  } else if (mainPathRelativeToDist === '' || mainPathRelativeToDist === '.') {
    // If the user customized their entry such that it is not inside `src/` folder
    // then they have to provide the outputFileName
    throw new Error(
      `There is a conflict between Nx-generated main file and the project's main file. Set --outputFileName=nx-main.js to fix this error.`
    );
  } else {
    mainWithRequireOverridesOutPath = path.parse(mainFileName).name;
  }

  return {
    in: mainWithRequireOverridesInPath,
    out: mainWithRequireOverridesOutPath,
  };
}

export function getRegisterFileContent(
  project: ProjectGraphProjectNode,
  paths: Record<string, string[]>,
  mainFile: string,
  outExtension = '.js'
) {
  mainFile = normalizePath(mainFile);

  // Sort by longest prefix so imports match the most specific path.
  const sortedKeys = Object.keys(paths).sort(
    (a: string, b: string) => getPrefixLength(b) - getPrefixLength(a)
  );
  const manifest: Array<{
    module: string;
    pattern: string;
    exactMatch?: string;
  }> = sortedKeys.reduce((acc, k) => {
    let exactMatch: string;

    // Nx generates a single path entry.
    // If more sophisticated setup is needed, we can consider tsconfig-paths.
    const pattern = paths[k][0];

    if (/.[cm]?ts$/.test(pattern)) {
      // Path specifies a single entry point e.g. "a/b/src/index.ts".
      // This is the default setup.
      const { dir, name } = path.parse(pattern);
      exactMatch = joinPathFragments(dir, `${name}${outExtension}`);
    }
    acc.push({ module: k, exactMatch, pattern });
    return acc;
  }, []);

  return `
/**
 * IMPORTANT: Do not modify this file.
 * This file allows the app to run without bundling in workspace libraries.
 * Must be contained in the ".nx" folder inside the output path.
 */
const Module = require('module');
const path = require('path');
const fs = require('fs');
const originalResolveFilename = Module._resolveFilename;
const distPath = __dirname;
const manifest = ${JSON.stringify(manifest)};

Module._resolveFilename = function(request, parent) {
  let found;
  for (const entry of manifest) {
    if (request === entry.module && entry.exactMatch) {
      const entry = manifest.find((x) => request === x.module || request.startsWith(x.module + "/"));
      const candidate = path.join(distPath, entry.exactMatch);
      if (isFile(candidate)) {
        found = candidate;
        break;
      }
    } else {
      const re = new RegExp(entry.module.replace(/\\*$/, "(?<rest>.*)"));
      const match = request.match(re);

      if (match?.groups) {
        const candidate = path.join(distPath, entry.pattern.replace("*", ""), match.groups.rest + ".js");
        if (isFile(candidate)) {
          found = candidate;
        }
      }

    }
  }
  if (found) {
    const modifiedArguments = [found, ...[].slice.call(arguments, 1)];
    return originalResolveFilename.apply(this, modifiedArguments);
  } else {
    return originalResolveFilename.apply(this, arguments);
  }
};

function isFile(s) {
  try {
    return fs.statSync(s).isFile();
  } catch (_e) {
    return false;
  }
}

// Call the user-defined main.
require('${mainFile}');
`;
}

function getPrefixLength(pattern: string): number {
  return pattern.substring(0, pattern.indexOf('*')).length;
}

function getTsConfigCompilerPaths(context: ExecutorContext): {
  [key: string]: string[];
} {
  const tsconfigPaths = require('tsconfig-paths');
  const tsConfigResult = tsconfigPaths.loadConfig(getRootTsConfigPath(context));
  if (tsConfigResult.resultType !== 'success') {
    throw new Error('Cannot load tsconfig file');
  }
  return tsConfigResult.paths;
}

function getRootTsConfigPath(context: ExecutorContext): string | null {
  for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
    const tsConfigPath = path.join(context.root, tsConfigName);
    if (existsSync(tsConfigPath)) {
      return tsConfigPath;
    }
  }

  throw new Error(
    'Could not find a root tsconfig.json or tsconfig.base.json file.'
  );
}
