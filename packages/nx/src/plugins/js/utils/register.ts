import { dirname, join } from 'path';
import type { CompilerOptions } from 'typescript';
import { logger, NX_PREFIX, stripIndent } from '../../../utils/logger';

const swcNodeInstalled = packageIsInstalled('@swc-node/register');
const tsNodeInstalled = packageIsInstalled('ts-node/register');
let ts: typeof import('typescript');

/**
 * Optionally, if swc-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing custom workspace projects.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * the root of their project and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 *
 * @returns cleanup function
 */
export const registerTsProject = (
  path: string,
  configFilename = 'tsconfig.json'
): (() => void) => {
  const tsConfigPath = join(path, configFilename);
  const compilerOptions: CompilerOptions = readCompilerOptions(tsConfigPath);

  const cleanupFunctions: ((...args: unknown[]) => unknown)[] = [
    registerTsConfigPaths(tsConfigPath),
    registerTranspiler(compilerOptions),
  ];

  return () => {
    for (const fn of cleanupFunctions) {
      fn();
    }
  };
};

export function getSwcTranspiler(
  compilerOptions: CompilerOptions
): (...args: unknown[]) => unknown {
  type ISwcRegister = typeof import('@swc-node/register/register')['register'];

  // These are requires to prevent it from registering when it shouldn't
  const register = require('@swc-node/register/register')
    .register as ISwcRegister;

  const cleanupFn = register(compilerOptions);

  return typeof cleanupFn === 'function' ? cleanupFn : () => {};
}

export function getTsNodeTranspiler(
  compilerOptions: CompilerOptions
): (...args: unknown[]) => unknown {
  const { register } = require('ts-node') as typeof import('ts-node');
  // ts-node doesn't provide a cleanup method
  const service = register({
    transpileOnly: true,
    compilerOptions: getTsNodeCompilerOptions(compilerOptions),
  });

  const { transpiler, swc } = service.options;

  // Don't warn if a faster transpiler is enabled
  if (!transpiler && !swc) {
    warnTsNodeUsage();
  }

  return () => {};
}

export function getTranspiler(compilerOptions: CompilerOptions) {
  const preferTsNode = process.env.NX_PREFER_TS_NODE === 'true';

  if (swcNodeInstalled && !preferTsNode) {
    return () => getSwcTranspiler(compilerOptions);
  }

  // We can fall back on ts-node if it's available
  if (tsNodeInstalled) {
    return () => getTsNodeTranspiler(compilerOptions);
  }
}

/**
 * Register ts-node or swc-node given a set of compiler options.
 *
 * Note: Several options require enums from typescript. To avoid importing typescript,
 * use import type + raw values
 *
 * @returns cleanup method
 */
export function registerTranspiler(
  compilerOptions: CompilerOptions
): () => void {
  // Function to register transpiler that returns cleanup function
  const transpiler = getTranspiler(compilerOptions);

  if (!transpiler) {
    warnNoTranspiler();
    return () => {};
  }

  return transpiler();
}

/**
 * @param tsConfigPath Adds the paths from a tsconfig file into node resolutions
 * @returns cleanup function
 */
export function registerTsConfigPaths(tsConfigPath): () => void {
  try {
    /**
     * Load the ts config from the source project
     */
    const tsconfigPaths: typeof import('tsconfig-paths') = require('tsconfig-paths');
    const tsConfigResult = tsconfigPaths.loadConfig(tsConfigPath);
    /**
     * Register the custom workspace path mappings with node so that workspace libraries
     * can be imported and used within project
     */
    if (tsConfigResult.resultType === 'success') {
      return tsconfigPaths.register({
        baseUrl: tsConfigResult.absoluteBaseUrl,
        paths: tsConfigResult.paths,
      });
    }
  } catch (err) {
    warnNoTsconfigPaths();
  }
  return () => {};
}

function readCompilerOptions(tsConfigPath): CompilerOptions {
  if (swcNodeInstalled) {
    const {
      readDefaultTsConfig,
    }: typeof import('@swc-node/register/read-default-tsconfig') = require('@swc-node/register/read-default-tsconfig');
    return readDefaultTsConfig(tsConfigPath);
  } else {
    return readCompilerOptionsWithTypescript(tsConfigPath);
  }
}

function readCompilerOptionsWithTypescript(tsConfigPath) {
  if (!ts) {
    ts = require('typescript');
  }
  const { readConfigFile, parseJsonConfigFileContent, sys } = ts;
  const jsonContent = readConfigFile(tsConfigPath, sys.readFile);
  const { options } = parseJsonConfigFileContent(
    jsonContent.config,
    sys,
    dirname(tsConfigPath)
  );
  // This property is returned in compiler options for some reason, but not part of the typings.
  // ts-node fails on unknown props, so we have to remove it.
  delete options.configFilePath;
  return options;
}

function warnTsNodeUsage() {
  logger.warn(
    stripIndent(`${NX_PREFIX} Falling back to ts-node for local typescript execution. This may be a little slower.
  - To fix this, ensure @swc-node/register and @swc/core have been installed`)
  );
}

function warnNoTsconfigPaths() {
  logger.warn(
    stripIndent(`${NX_PREFIX} Unable to load tsconfig-paths, workspace libraries may be inaccessible.
  - To fix this, install tsconfig-paths with npm/yarn/pnpm`)
  );
}

function warnNoTranspiler() {
  logger.warn(
    stripIndent(`${NX_PREFIX} Unable to locate swc-node or ts-node. Nx will be unable to run local ts files without transpiling.
  - To fix this, ensure @swc-node/register and @swc/core have been installed`)
  );
}

function packageIsInstalled(m: string) {
  try {
    const p = require.resolve(m);
    return true;
  } catch {
    return false;
  }
}

/**
 * ts-node requires string values for enum based typescript options.
 * `register`'s signature just types the field as `object`, so we
 * unfortunately do not get any kind of type safety on this.
 */
export function getTsNodeCompilerOptions(compilerOptions: CompilerOptions) {
  if (!ts) {
    ts = require('typescript');
  }

  const flagMap: Partial<{
    [key in keyof RemoveIndex<CompilerOptions>]: keyof typeof ts;
  }> = {
    module: 'ModuleKind',
    target: 'ScriptTarget',
    moduleDetection: 'ModuleDetectionKind',
    newLine: 'NewLineKind',
    moduleResolution: 'ModuleResolutionKind',
    importsNotUsedAsValues: 'ImportsNotUsedAsValues',
  };

  const result: { [key in keyof CompilerOptions]: any } = {
    ...compilerOptions,
  };

  for (const flag in flagMap) {
    if (compilerOptions[flag]) {
      result[flag] = ts[flagMap[flag]][compilerOptions[flag]];
    }
  }

  delete result.pathsBasePath;
  delete result.configFilePath;

  // instead of mapping to enum value we just remove it as it shouldn't ever need to be set for ts-node
  delete result.jsx;

  // lib option is in the format `lib.es2022.d.ts`, so we need to remove the leading `lib.` and trailing `.d.ts` to make it valid
  result.lib = result.lib?.map((value) => {
    return value.replace(/^lib\./, '').replace(/\.d\.ts$/, '');
  });

  if (result.moduleResolution) {
    result.moduleResolution =
      result.moduleResolution === 'NodeJs'
        ? 'node'
        : result.moduleResolution.toLowerCase();
  }

  return result;
}

/**
 * Index keys allow empty objects, where as "real" keys
 * require a value. Thus, this filters out index keys
 * See: https://stackoverflow.com/a/68261113/3662471
 */
type RemoveIndex<T> = {
  [K in keyof T as {} extends Record<K, 1> ? never : K]: T[K];
};
