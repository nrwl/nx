import * as esbuild from 'esbuild';
import * as path from 'path';
import { parse } from 'path';
import {
  ExecutorContext,
  getImportPath,
  joinPathFragments,
} from '@nrwl/devkit';
import { mkdirSync, writeFileSync } from 'fs';

import { getClientEnvironment } from '../../../utils/environment-variables';
import {
  EsBuildExecutorOptions,
  NormalizedEsBuildExecutorOptions,
} from '../schema';
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
    ...options.esbuildOptions,
    entryNames:
      options.outputHashing === 'all' ? '[dir]/[name].[hash]' : '[dir]/[name]',
    bundle: options.bundle,
    // Cannot use external with bundle option
    external: options.bundle
      ? [...(options.esbuildOptions?.external ?? []), ...options.external]
      : undefined,
    minify: options.minify,
    platform: options.platform,
    target: options.target,
    metafile: options.metafile,
    tsconfig: options.tsConfig,
    format,
    outExtension: {
      '.js': outExtension,
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

  if (options.bundle) {
    esbuildOptions.entryPoints = entryPoints;
  } else if (options.platform === 'node' && format === 'cjs') {
    // When target platform Node and target format is CJS, then also transpile workspace libs used by the app.
    // Provide a `require` override in the main entry file so workspace libs can be loaded when running the app.
    const manifest: Array<{ module: string; root: string }> = []; // Manifest allows the built app to load compiled workspace libs.
    const entryPointsFromProjects = getEntryPoints(
      context.projectName,
      context,
      {
        initialEntryPoints: entryPoints,
        recursive: true,
        onProjectFilesMatched: (currProjectName) => {
          manifest.push({
            module: getImportPath(
              context.nxJsonConfiguration.npmScope,
              currProjectName
            ),
            root: context.projectGraph.nodes[currProjectName].data.root,
          });
        },
      }
    );

    esbuildOptions.entryPoints = [
      // Write a main entry file that registers workspace libs and then calls the user-defined main.
      writeTmpEntryWithRequireOverrides(
        manifest,
        outExtension,
        options,
        context
      ),
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
      initialEntryPoints: entryPoints,
      recursive: false,
    });
  }

  return esbuildOptions;
}

export function getOutExtension(
  format: 'cjs' | 'esm',
  options: EsBuildExecutorOptions
): '.cjs' | '.mjs' | '.js' {
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

function writeTmpEntryWithRequireOverrides(
  manifest: Array<{ module: string; root: string }>,
  outExtension: '.cjs' | '.js' | '.mjs',
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
): { in: string; out: string } {
  const project = context.projectGraph?.nodes[context.projectName];
  // Write a temp main entry source that registers workspace libs.
  const tmpPath = path.join(
    context.root,
    'tmp',
    context.projectGraph?.nodes[context.projectName].name
  );
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
      manifest,
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

function getRegisterFileContent(
  manifest: Array<{ module: string; root: string }>,
  mainFile: string,
  outExtension = '.js'
) {
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
  const entry = manifest.find(x => request === x.module || request.startsWith(x.module + '/'));
  let found;
  if (entry) {
    if (request === entry.module) {
      // Known entry paths for libraries. Add more if missing.
      const candidates = [
        path.join(distPath, entry.root, 'src/index' + '${outExtension}'),
        path.join(distPath, entry.root, 'src/main' + '${outExtension}'),
        path.join(distPath, entry.root, 'index' + '${outExtension}'),
        path.join(distPath, entry.root, 'main' + '${outExtension}')
      ];
      found = candidates.find(f => fs.statSync(f).isFile());
    } else {
      const candidate = path.join(distPath, entry.root, request.replace(entry.module, '') + '${outExtension}');
      if (fs.statSync(candidate).isFile()) {
        found = candidate;
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

// Call the user-defined main.
require('${mainFile}');
`;
}
