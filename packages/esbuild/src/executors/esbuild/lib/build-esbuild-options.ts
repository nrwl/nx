import * as esbuild from 'esbuild';
import * as path from 'path';
import { existsSync, mkdirSync, writeFileSync, lstatSync } from 'fs';
import {
  ExecutorContext,
  joinPathFragments,
  normalizePath,
  ProjectGraphProjectNode,
  readJsonFile,
  workspaceRoot,
} from '@nx/devkit';

import { getClientEnvironment } from '../../../utils/environment-variables';
import { NormalizedEsBuildExecutorOptions } from '../schema';
import { getEntryPoints } from '../../../utils/get-entry-points';
import { join, relative } from 'path';

const ESM_FILE_EXTENSION = '.js'; // Changed from .mjs to match package.json exports
const CJS_FILE_EXTENSION = '.cjs';

export function buildEsbuildOptions(
  format: 'cjs' | 'esm',
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
): esbuild.BuildOptions {
  const outExtension = getOutExtension(format, options, context);

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
    tsconfig: relative(process.cwd(), join(context.root, options.tsConfig)),
    sourcemap:
      (options.sourcemap ?? options.userDefinedBuildOptions?.sourcemap) ||
      false,
    format,
    outExtension: {
      '.js': outExtension,
    },
  };

  if (options.platform === 'browser') {
    esbuildOptions.define = {
      ...getClientEnvironment(),
      ...options.userDefinedBuildOptions?.define,
    };
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
    // Provide a loader override in the main entry file so workspace libs can be loaded when running the app.
    const paths = options.isTsSolutionSetup
      ? createPathsFromTsConfigReferences(context)
      : getTsConfigCompilerPaths(context);

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
      writeTmpEntryWithRequireOverrides(
        paths,
        outExtension,
        options,
        context,
        format
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
      initialTsConfigFileName: options.tsConfig,
      initialEntryPoints: entryPoints,
      recursive: false,
    });
  }

  return esbuildOptions;
}

/**
 * When using TS project references we need to map the paths to the referenced projects.
 * This is necessary because esbuild does not support project references out of the box.
 * @param context ExecutorContext
 */
export function createPathsFromTsConfigReferences(
  context: ExecutorContext
): Record<string, string[]> {
  const {
    findAllProjectNodeDependencies,
  } = require('nx/src/utils/project-graph-utils');
  const {
    isValidPackageJsonBuildConfig,
  } = require('@nx/js/src/plugins/typescript/util');
  const { readTsConfig } = require('@nx/js');
  const {
    findRuntimeTsConfigName,
  } = require('@nx/js/src/utils/typescript/ts-solution-setup');

  const deps = findAllProjectNodeDependencies(
    context.projectName,
    context.projectGraph
  );
  const tsConfig = readJsonFile(
    joinPathFragments(context.root, 'tsconfig.json')
  );
  const referencesAsPaths = new Set(
    tsConfig.references.reduce((acc, ref) => {
      if (!ref.path) return acc;

      const fullPath = joinPathFragments(workspaceRoot, ref.path);

      try {
        if (lstatSync(fullPath).isDirectory()) {
          acc.push(fullPath);
        }
      } catch {
        // Ignore errors (e.g., path doesn't exist)
      }

      return acc;
    }, [])
  );

  // for each dep we check if it contains a build target
  // we only want to add the paths for projects that do not have a build target
  return deps.reduce((acc, dep) => {
    const projectNode = context.projectGraph.nodes[dep];
    const projectPath = joinPathFragments(workspaceRoot, projectNode.data.root);
    const resolvedTsConfigPath =
      findRuntimeTsConfigName(projectPath) ?? 'tsconfig.json';
    const projTsConfig = readTsConfig(resolvedTsConfigPath) as any;

    const projectPkgJson = readJsonFile(
      joinPathFragments(projectPath, 'package.json')
    );

    if (
      projTsConfig &&
      !isValidPackageJsonBuildConfig(
        projTsConfig,
        workspaceRoot,
        projectPath
      ) &&
      projectPkgJson?.name
    ) {
      const entryPoint = getProjectEntryPoint(projectPkgJson, projectPath);
      if (referencesAsPaths.has(projectPath)) {
        acc[projectPkgJson.name] = [path.relative(workspaceRoot, entryPoint)];
      }
    }

    return acc;
  }, {});
}

// Get the entry point for the project
function getProjectEntryPoint(projectPkgJson: any, projectPath: string) {
  let entryPoint = null;
  if (typeof projectPkgJson.exports === 'string') {
    // If exports is a string, use it as the entry point
    entryPoint = path.relative(
      workspaceRoot,
      joinPathFragments(projectPath, projectPkgJson.exports)
    );
  } else if (
    typeof projectPkgJson.exports === 'object' &&
    projectPkgJson.exports['.']
  ) {
    // If exports is an object and has a '.' key, process it
    const exportEntry = projectPkgJson.exports['.'];
    if (typeof exportEntry === 'object') {
      entryPoint =
        exportEntry.import ||
        exportEntry.require ||
        exportEntry.default ||
        null;
    } else if (typeof exportEntry === 'string') {
      entryPoint = exportEntry;
    }

    if (entryPoint) {
      entryPoint = path.relative(
        workspaceRoot,
        joinPathFragments(projectPath, entryPoint)
      );
    }
  }

  // If no exports were found, fall back to main and module
  if (!entryPoint) {
    if (projectPkgJson.main) {
      entryPoint = path.relative(
        workspaceRoot,
        joinPathFragments(projectPath, projectPkgJson.main)
      );
    } else if (projectPkgJson.module) {
      entryPoint = path.relative(
        workspaceRoot,
        joinPathFragments(projectPath, projectPkgJson.module)
      );
    }
  }
  return entryPoint;
}

export function getOutExtension(
  format: 'cjs' | 'esm',
  options: Pick<NormalizedEsBuildExecutorOptions, 'userDefinedBuildOptions'>,
  context?: ExecutorContext
): '.cjs' | '.mjs' | '.js' {
  const userDefinedExt = options.userDefinedBuildOptions?.outExtension?.['.js'];
  // Allow users to change the output extensions from default CJS and ESM extensions.
  // CJS -> .js
  // ESM -> .mjs for libraries, .js for applications

  if (userDefinedExt === '.js' && format === 'cjs') {
    return '.js';
  }

  if (userDefinedExt === '.mjs' && format === 'esm') {
    return '.mjs';
  }

  if (format === 'esm') {
    return '.js';
  }

  return CJS_FILE_EXTENSION;
}

export function getOutfile(
  format: 'cjs' | 'esm',
  options: NormalizedEsBuildExecutorOptions,
  context: ExecutorContext
) {
  const ext = getOutExtension(format, options, context);
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
  context: ExecutorContext,
  format: 'cjs' | 'esm' = 'cjs'
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
  const mainFile = `./${path.join(
    mainPathRelativeToDist,
    `${mainFileName}${outExtension}`
  )}`;

  writeFileSync(
    mainWithRequireOverridesInPath,
    getRegisterFileContent(project, paths, mainFile, outExtension, format)
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
  outExtension = '.js',
  format: 'cjs' | 'esm' = 'cjs'
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

  if (format === 'esm') {
    return `
/**
 * IMPORTANT: Do not modify this file.
 * This file allows the app to run without bundling in workspace libraries.
 * Must be contained in the ".nx" folder inside the output path.
 */
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distPath = __dirname;
const manifest = ${JSON.stringify(manifest)};

// Simple ESM resolver for workspace libraries
const originalResolve = import.meta.resolve;
if (originalResolve) {
  import.meta.resolve = function(specifier, parent) {
    const matchingEntry = manifest.find(
      (entry) => specifier === entry.module || specifier.startsWith(entry.module + '/')
    );
    
    if (matchingEntry) {
      if (matchingEntry.exactMatch) {
        const candidate = join(distPath, matchingEntry.exactMatch);
        if (existsSync(candidate)) {
          return pathToFileURL(candidate).href;
        }
      } else {
        const re = new RegExp(matchingEntry.module.replace(/\\*$/, "(?<rest>.*)"));
        const match = specifier.match(re);
        if (match?.groups) {
          const candidate = join(distPath, matchingEntry.pattern.replace("*", ""), match.groups.rest);
          if (existsSync(candidate)) {
            return pathToFileURL(candidate).href;
          }
        }
      }
    }
    
    return originalResolve.call(this, specifier, parent);
  };
}

// Call the user-defined main.
await import(pathToFileURL(join(distPath, '${mainFile}')).href);
`;
  } else {
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
        const candidate = path.join(distPath, entry.pattern.replace("*", ""), match.groups.rest);
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
    require.resolve(s);
    return true;
  } catch (_e) {
    return false;
  }
}

// Call the user-defined main.
module.exports = require('${mainFile}');
`;
  }
}

function getPrefixLength(pattern: string): number {
  const prefixIfWildcard = pattern.substring(0, pattern.indexOf('*')).length;
  const prefixWithoutWildcard = pattern.substring(
    0,
    pattern.lastIndexOf('/')
  ).length;
  // if the pattern doesn't contain '*', then the length is always 0
  // This causes issues when there are sub packages such as
  // @nx/core
  // @nx/core/testing
  return prefixIfWildcard || prefixWithoutWildcard;
}

function getTsConfigCompilerPaths(context: ExecutorContext): {
  [key: string]: string[];
} {
  const rootTsConfigPath = getRootTsConfigPath(context);
  if (!rootTsConfigPath) {
    return {};
  }

  const tsconfigPaths = require('tsconfig-paths');
  const tsConfigResult = tsconfigPaths.loadConfig(rootTsConfigPath);
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

  return null;
}
