import { dirname, isAbsolute, join, resolve, sep } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { TsConfigOptions } from 'ts-node';
import type { CompilerOptions } from 'typescript';
import { logger, NX_PREFIX, stripIndent } from '../../../utils/logger';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getRootTsConfigPath, readTsConfigWithoutFiles } from './typescript';

const swcNodeInstalled = packageIsInstalled('@swc-node/register');
const tsNodeInstalled = packageIsInstalled('ts-node/register');
let ts: typeof import('typescript');

let isTsEsmLoaderRegistered = false;

/**
 * Force-register an ESM loader (`@swc-node/register/esm` if available, else
 * `ts-node/esm`) via `Module.register` so dynamic `import()` of TS files
 * goes through a transpiler.
 *
 * **IMPORTANT — global side effect:** `Module.register` is one-shot per
 * process and applies to *every* subsequent ESM resolution in the process.
 * Calling this trades native Node.js TypeScript stripping for transpiled
 * loading on the dynamic-import path for the rest of the run. CJS
 * `require()` is unaffected (different hook), so `.cts` files via require
 * keep using native strip + swc-node's `Module._extensions` hook.
 *
 * Required for the niche case where an ESM config (`.mts` or `.ts` resolved
 * as ESM) combines top-level await with TypeScript syntax that native strip
 * can't handle (`enum`, runtime `namespace`, etc.). TLA forces dynamic
 * `import()`, which bypasses the CJS hook chain - the only way to intercept
 * is `Module.register`.
 *
 * Idempotent: subsequent calls are no-ops.
 *
 * Throws if neither `@swc-node/register` nor `ts-node` is installed.
 */
export function forceRegisterEsmLoader(): void {
  ensureEsmLoaderRegistered({ required: true });
}

function ensureEsmLoaderRegistered(opts: { required: boolean }): void {
  if (isTsEsmLoaderRegistered) return;

  const module = require('node:module') as typeof import('node:module');
  if (typeof module.register !== 'function') {
    if (opts.required) {
      throw new Error(
        `${NX_PREFIX} Module.register is not available in this Node.js version - cannot register an ESM loader for the TypeScript fallback. ${STRIP_TYPES_OPT_OUT_HINT}`
      );
    }
    return;
  }

  // ts-node reads compilerOptions from this env var. Setting nodenext
  // module/resolution avoids surprises when ts-node is the chosen loader.
  process.env.TS_NODE_COMPILER_OPTIONS ??= JSON.stringify({
    moduleResolution: 'nodenext',
    module: 'nodenext',
  });

  // Prefer @swc-node/register/esm (faster) over ts-node/esm.
  const swcEsm = tryResolveLoader('@swc-node/register/esm');
  const tsNodeEsm = tryResolveLoader('ts-node/esm');
  const loaderPath = swcEsm ?? tsNodeEsm;

  if (!loaderPath) {
    if (opts.required) {
      throw new Error(
        `${NX_PREFIX} Cannot register an ESM TypeScript loader to fall back from native stripping. Install @swc-node/register or ts-node, or ${STRIP_TYPES_OPT_OUT_HINT}`
      );
    }
    isTsEsmLoaderRegistered = true;
    return;
  }

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    const loaderName = swcEsm ? '@swc-node/register/esm' : 'ts-node/esm';
    logger.warn(
      stripIndent(
        `${NX_PREFIX} Registering ESM TypeScript loader ${loaderName}. All subsequent ESM imports in this process will go through it - native Node.js TypeScript stripping is forfeited for the dynamic-import path.`
      )
    );
  }

  const url = require('node:url') as typeof import('node:url');
  module.register(url.pathToFileURL(loaderPath));
  isTsEsmLoaderRegistered = true;
}

function tryResolveLoader(specifier: string): string | null {
  try {
    return require.resolve(specifier);
  } catch {
    return null;
  }
}

/**
 * tsx is a utility to run TypeScript files in node which is growing in popularity:
 * https://tsx.is
 *
 * Behind the scenes it is invoking node with relevant --require and --import flags.
 *
 * If the user is invoking Nx via a script which is being invoked via tsx, then we
 * do not need to register any transpiler at all as the environment will have already
 * been configured by tsx. In fact, registering a transpiler such as ts-node or swc
 * in this case causes issues.
 *
 * Because node is being invoked by tsx, the tsx binary does not end up in the final
 * process.argv and so we need to check a few possible things to account for usage
 * via different package managers (e.g. pnpm does not set process._ to tsx, but rather
 * pnpm itself, modern yarn does not set process._ at all etc.).
 */
const isInvokedByTsx: boolean = (() => {
  if (process.env._?.endsWith(`${sep}tsx`)) {
    return true;
  }
  const requireArgs: string[] = [];
  const importArgs: string[] = [];
  (process.execArgv ?? []).forEach((arg, i) => {
    if (arg === '-r' || arg === '--require') {
      requireArgs.push(process.execArgv[i + 1]);
    }
    if (arg === '--import') {
      importArgs.push(process.execArgv[i + 1]);
    }
  });
  const isTsxPath = (p: string) => p.includes(`${sep}tsx${sep}`);
  return (
    requireArgs.some((a) => isTsxPath(a)) ||
    importArgs.some((a) => isTsxPath(a))
  );
})();

/**
 * Whether the current Node.js runtime exposes native TypeScript type
 * stripping. This is the authoritative gate - it correctly handles every
 * way Node ships TS support:
 *   - Node 23.6+: unflagged, on by default
 *   - Node 22.18+ LTS: backported unflagged
 *   - Node 22.6-22.17 + `--experimental-strip-types` (or `--experimental-transform-types`)
 *
 * `process.features.typescript` is `'strip' | 'transform' | false`.
 */
const nodeSupportsNativeTypescript: boolean = !!(process as any).features
  ?.typescript;

/**
 * When process.features.typescript is truthy, default to letting Node.js
 * handle TypeScript natively via type stripping and skip registering swc-node
 * or ts-node. Users can opt out by setting NX_PREFER_NODE_STRIP_TYPES=false.
 *
 * Some constructs (enum, runtime namespace, legacy decorators,
 * import = require, parameter properties, etc.) aren't supported by native
 * type stripping. `loadTsFile` catches these failures and falls back to
 * registering swc/ts-node + tsconfig-paths automatically.
 *
 * See: https://nodejs.org/api/typescript.html#full-typescript-support
 */
const preferNodeStripTypes: boolean = (() => {
  if (!nodeSupportsNativeTypescript) {
    return false;
  }
  return process.env.NX_PREFER_NODE_STRIP_TYPES !== 'false';
})();

/**
 * Skip tsconfig-paths registration on the swc/ts-node fallback path. Useful
 * for workspaces relying on package manager workspaces (pnpm, yarn, npm) for
 * project linking, where tsconfig path aliases aren't needed.
 */
const disableTsConfigPaths: boolean =
  process.env.NX_DISABLE_TSCONFIG_PATHS === 'true';

/**
 * Whether Nx will defer to Node's native TypeScript stripping for the next
 * `.ts` load. Mirrors the gate used by `loadTsFile`/`registerTsProject` so
 * other registration sites (e.g. plugin transpiler) can stay aligned.
 */
export function isNativeStripPreferred(): boolean {
  return preferNodeStripTypes;
}

/**
 * Optionally, if swc-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing custom workspace projects.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * the root of their project and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 *
 * Behavior change in v23: when the runtime exposes native TypeScript type
 * stripping (`process.features.typescript`), this function skips the
 * transpiler (Node handles `.ts` directly) but still registers
 * `tsconfig-paths`. Path mapping is orthogonal to transpilation - callers
 * relying on tsconfig `paths` for workspace alias resolution still get them.
 * For loading a `.ts` file whose syntax native strip can't handle (`enum`,
 * runtime `namespace`, legacy decorators, etc.), use `loadTsFile`, which
 * registers swc/ts-node + tsconfig-paths on demand. To restore the legacy
 * behavior (always register swc/ts-node + tsconfig-paths up front), set
 * `NX_PREFER_NODE_STRIP_TYPES=false`.
 *
 * @returns cleanup function
 */
export function registerTsProject(tsConfigPath: string): () => void;
/**
 * Optionally, if swc-node and tsconfig-paths are available in the current workspace, apply the require
 * register hooks so that .ts files can be used for writing custom workspace projects.
 *
 * If ts-node and tsconfig-paths are not available, the user can still provide an index.js file in
 * the root of their project and the fundamentals will still work (but
 * workspace path mapping will not, for example).
 *
 * @returns cleanup function
 * @deprecated This signature will be removed in Nx v19. You should pass the full path to the tsconfig in the first argument.
 */
export function registerTsProject(path: string, configFilename: string);
export function registerTsProject(
  path: string,
  configFilename?: string
): () => void {
  // See explanation alongside isInvokedByTsx declaration
  if (isInvokedByTsx) {
    return () => {};
  }

  const tsConfigPath = configFilename ? join(path, configFilename) : path;

  // Under native strip we skip the transpiler (Node handles `.ts` directly)
  // but still register tsconfig-paths. Path mapping is orthogonal to
  // transpilation: code calling `registerTsProject` for path aliases
  // (e.g. test setup files requiring `@my-org/lib`) gets nothing back if
  // both are skipped. Package-manager-workspace symlinks aren't a
  // universal substitute - explicit tsconfig `paths` configs still need
  // runtime alias resolution. Callers needing the transpiler for
  // unsupported syntax (enum, runtime namespace, legacy decorators, etc.)
  // should use `loadTsFile` instead, which registers swc/ts-node +
  // tsconfig-paths on demand.
  //
  // We also register TypeScript extensions as passthrough stubs in
  // `require.extensions` so that `require.resolve('./rule')` can find
  // `./rule/index.ts` (directory resolution) and `./rule.ts` (explicit
  // extension). Without this, Node's CJS loader doesn't know `.ts` is a
  // valid extension and `require.resolve` throws MODULE_NOT_FOUND even
  // though Node can execute the file via native type-stripping.
  // The stubs do NOT transpile - Node's native strip handles execution.
  if (preferNodeStripTypes) {
    const cleanupExtensions = registerTsExtensionsForResolution();
    const cleanupPaths = registerTsConfigPaths(tsConfigPath);
    return () => {
      cleanupPaths();
      cleanupExtensions();
    };
  }

  // Legacy path: prior to v23, Nx always registered swc-node/ts-node and
  // tsconfig-paths to load .ts config files. v23+ prefers Node's built-in
  // type stripping; this branch only runs when the user opted out via
  // NX_PREFER_NODE_STRIP_TYPES=false or when strip is unavailable.
  const { compilerOptions, tsConfigRaw } = readCompilerOptions(tsConfigPath);

  const cleanupFunctions: ((...args: unknown[]) => unknown)[] = [
    registerTsConfigPaths(tsConfigPath),
    registerTranspiler(compilerOptions, tsConfigRaw),
  ];

  // Best-effort ESM loader registration so dynamic import() of .ts/.mts
  // files goes through a transpiler. No-op if no ESM loader package is
  // installed.
  ensureEsmLoaderRegistered({ required: false });

  return () => {
    for (const fn of cleanupFunctions) {
      fn();
    }
  };
}

export function getSwcTranspiler(
  compilerOptions: CompilerOptions
): (...args: unknown[]) => unknown {
  type ISwcRegister =
    (typeof import('@swc-node/register/register'))['register'];

  // These are requires to prevent it from registering when it shouldn't
  const register = require('@swc-node/register/register')
    .register as ISwcRegister;

  const cleanupFn = register({
    ...compilerOptions,
    baseUrl: compilerOptions.baseUrl ?? './',
  });

  return typeof cleanupFn === 'function' ? cleanupFn : () => {};
}

export function getTsNodeTranspiler(
  compilerOptions: CompilerOptions,
  tsNodeOptions?: TsConfigOptions,
  preferTsNode?: boolean
): (...args: unknown[]) => unknown {
  const { register } = require('ts-node') as typeof import('ts-node');
  // ts-node doesn't provide a cleanup method
  const service = register({
    ...tsNodeOptions,
    transpileOnly: true,
    compilerOptions: getTsNodeCompilerOptions({
      ...tsNodeOptions?.compilerOptions,
      ...compilerOptions,
    }),
    // we already read and provide the compiler options, so prevent ts-node from reading them again
    skipProject: true,
  });

  const { transpiler, swc } = service.options;

  // Don't warn if a faster transpiler is enabled
  if (!transpiler && !swc && !preferTsNode) {
    warnTsNodeUsage();
  }

  return () => {
    // Do not cleanup ts-node service since other consumers may need it
  };
}

/**
 * Given the raw "ts-node" sub-object from a tsconfig, return an object with only the properties
 * recognized by "ts-node"
 *
 * Adapted from the function of the same name in ts-node
 */
function filterRecognizedTsConfigTsNodeOptions(jsonObject: any): {
  recognized: TsConfigOptions;
  unrecognized: any;
} {
  if (typeof jsonObject !== 'object' || jsonObject === null) {
    return { recognized: {}, unrecognized: {} };
  }
  const {
    compiler,
    compilerHost,
    compilerOptions,
    emit,
    files,
    ignore,
    ignoreDiagnostics,
    logError,
    preferTsExts,
    pretty,
    require,
    skipIgnore,
    transpileOnly,
    typeCheck,
    transpiler,
    scope,
    scopeDir,
    moduleTypes,
    experimentalReplAwait,
    swc,
    experimentalResolver,
    esm,
    experimentalSpecifierResolution,
    experimentalTsImportSpecifiers,
    ...unrecognized
  } = jsonObject as TsConfigOptions;
  const filteredTsConfigOptions = {
    compiler,
    compilerHost,
    compilerOptions,
    emit,
    experimentalReplAwait,
    files,
    ignore,
    ignoreDiagnostics,
    logError,
    preferTsExts,
    pretty,
    require,
    skipIgnore,
    transpileOnly,
    typeCheck,
    transpiler,
    scope,
    scopeDir,
    moduleTypes,
    swc,
    experimentalResolver,
    esm,
    experimentalSpecifierResolution,
    experimentalTsImportSpecifiers,
  };
  // Use the typechecker to make sure this implementation has the correct set of properties
  const catchExtraneousProps: keyof TsConfigOptions =
    null as any as keyof typeof filteredTsConfigOptions;
  const catchMissingProps: keyof typeof filteredTsConfigOptions =
    null as any as keyof TsConfigOptions;
  return { recognized: filteredTsConfigOptions, unrecognized };
}

const registered = new Map<
  string,
  { refCount: number; cleanup: () => (...args: unknown[]) => unknown }
>();

export function getTranspiler(
  compilerOptions: CompilerOptions,
  tsConfigRaw?: unknown
) {
  const preferTsNode = process.env.NX_PREFER_TS_NODE === 'true';

  if (!ts) {
    ts = require('typescript');
  }

  compilerOptions.lib = ['es2021'];
  compilerOptions.module = ts.ModuleKind.CommonJS;
  // use NodeJs module resolution until support for TS 4.x is dropped and then
  // we can switch to Node10
  compilerOptions.moduleResolution = ts.ModuleResolutionKind.NodeJs;
  compilerOptions.customConditions = null;
  compilerOptions.target = ts.ScriptTarget.ES2021;
  compilerOptions.inlineSourceMap = true;
  compilerOptions.skipLibCheck = true;
  // These options are different per project, and since they are not needed for transpilation, we can remove them so we have more cache hits.
  compilerOptions.outDir = undefined;
  compilerOptions.outFile = undefined;
  compilerOptions.declaration = undefined;
  compilerOptions.declarationMap = undefined;
  compilerOptions.composite = undefined;
  compilerOptions.tsBuildInfoFile = undefined;
  delete compilerOptions.strict;

  let _getTranspiler: (
    compilerOptions: CompilerOptions,
    tsNodeOptions?: TsConfigOptions,
    preferTsNode?: boolean
  ) => (...args: unknown[]) => unknown;

  let registrationKey = JSON.stringify(compilerOptions);
  let tsNodeOptions: TsConfigOptions | undefined;
  if (swcNodeInstalled && !preferTsNode) {
    _getTranspiler = getSwcTranspiler;
  } else if (tsNodeInstalled) {
    // We can fall back on ts-node if it's available
    _getTranspiler = getTsNodeTranspiler;
    tsNodeOptions = filterRecognizedTsConfigTsNodeOptions(
      tsConfigRaw?.['ts-node']
    ).recognized;
    // include ts-node options in the registration key
    registrationKey += JSON.stringify(tsNodeOptions);
  } else {
    _getTranspiler = undefined;
  }

  // Just return if transpiler was already registered before.
  const registrationEntry = registered.get(registrationKey);
  if (registered.has(registrationKey)) {
    registrationEntry.refCount++;
    return registrationEntry.cleanup;
  }

  if (_getTranspiler) {
    const transpilerCleanup = _getTranspiler(
      compilerOptions,
      tsNodeOptions,
      preferTsNode
    );
    const currRegistrationEntry = {
      refCount: 1,
      cleanup: () => {
        return () => {
          currRegistrationEntry.refCount--;
          if (currRegistrationEntry.refCount === 0) {
            registered.delete(registrationKey);
            transpilerCleanup();
          }
        };
      },
    };
    registered.set(registrationKey, currRegistrationEntry);
    return currRegistrationEntry.cleanup;
  }
}

/**
 * Node.js throws this code when native type stripping hits an unsupported
 * construct (enum, runtime namespace, legacy decorators, import = require,
 * parameter properties on older Node, etc.).
 *
 * Exported for tests.
 */
export function isNativeTypeStripError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (
    (err as { code?: string }).code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'
  );
}

/**
 * Module resolution failures - typically a tsconfig path alias that hasn't
 * been registered yet, or a workspace lib not surfaced via package manager
 * symlinks. CJS uses `MODULE_NOT_FOUND`, ESM uses `ERR_MODULE_NOT_FOUND`.
 */
function isModuleNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  return code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND';
}

/**
 * A SyntaxError thrown while parsing a forced-CJS file (`.cts`/`.cjs`) as
 * CommonJS - typically ESM syntax in a CJS file (e.g. `export default` in
 * `.cts`). Pre-v23 this worked because swc-node's CJS hook compiled away the
 * ESM syntax; under native strip swc-node isn't registered, so the file
 * reaches Node's strict CJS parser. swc-node tolerates ESM syntax in `.cts`
 * (`register()` forces `module: commonjs` regardless of extension), so
 * escalating to the swc/ts-node fallback recovers the legacy behavior.
 */
export function isCjsSyntaxError(err: unknown, filePath: string): boolean {
  if (!(err instanceof SyntaxError)) return false;
  return filePath.endsWith('.cts') || filePath.endsWith('.cjs');
}

/**
 * A ReferenceError from Node treating a `.ts`/`.mts` file as ESM and the file
 * relying on a CJS-only global: `require`, `__dirname`, or `__filename`.
 * Pre-v23 swc-node compiled `.ts` to CJS where these globals exist; under
 * native strip Node detects ESM via `import`/`export` syntax and these globals
 * are undefined. Registering swc/ts-node compiles ESM->CJS and restores the
 * legacy globals.
 */
export function isRequireInEsmScopeError(
  err: unknown,
  filePath: string
): boolean {
  if (!(err instanceof ReferenceError)) return false;
  if (!(filePath.endsWith('.ts') || filePath.endsWith('.mts'))) return false;
  // Node's exact phrasing varies across versions / strip modes. Match the
  // bare-name form too (e.g. `__dirname is not defined`) so the fallback
  // still triggers when the trailing "in ES module scope" is absent.
  const msg = err.message;
  return /(require|__dirname|__filename) is not defined/.test(msg);
}

export function isTsEsmSyntaxError(err: unknown, filePath: string): boolean {
  if (!(err instanceof SyntaxError)) return false;
  if (!filePath.endsWith('.ts')) return false;
  // Node has multiple phrasings for ESM-in-CJS-scope syntax errors depending
  // on whether the offending token is `import` or `export` and which parser
  // path triggered: "Cannot use import statement outside a module" or
  // "Unexpected token 'export'" / "Unexpected token 'import'". swc-node's
  // CJS hook compiles ESM->CJS regardless of the surface error, so all of
  // these should escalate to the same fallback.
  const msg = err.message;
  return (
    msg.includes('Cannot use import statement outside a module') ||
    /Unexpected token ['"](export|import)['"]/.test(msg)
  );
}

export function isTsEsmNamedExportLinkageError(
  err: unknown,
  filePath: string
): boolean {
  if (!(err instanceof SyntaxError)) return false;
  return (
    (filePath.endsWith('.ts') || filePath.endsWith('.mts')) &&
    err.message.includes('does not provide an export named')
  );
}

/**
 * Hint appended to errors that the lazy fallback couldn't recover from.
 * Points users at the env opt-out for cases native strip can't reach (e.g.
 * ESM with top-level await + unsupported TS syntax, where swc-node's CJS
 * Module._extensions hook can't intercept dynamic `import()`).
 */
const NX_PREFER_NODE_STRIP_TYPES_DOCS_URL =
  'https://nx.dev/docs/reference/environment-variables#nx-prefer-node-strip-types';
const STRIP_TYPES_OPT_OUT_HINT = `Set NX_PREFER_NODE_STRIP_TYPES=false to opt out of Node's native TypeScript stripping and use swc/ts-node instead. See ${NX_PREFER_NODE_STRIP_TYPES_DOCS_URL}`;

/**
 * Load a TypeScript file via `require()`.
 *
 * When the runtime exposes native TypeScript stripping
 * (`process.features.typescript`) and the user hasn't opted out via
 * `NX_PREFER_NODE_STRIP_TYPES=false`, the file loads directly with no
 * swc/ts-node and no tsconfig-paths registration. If Node throws on an
 * unsupported construct (enum, runtime namespace, legacy decorators, etc.),
 * this registers swc/ts-node + tsconfig-paths and retries - matching the
 * pre-v23 registration. Set `NX_DISABLE_TSCONFIG_PATHS=true` to skip
 * tsconfig-paths even on fallback (useful when relying on package manager
 * workspaces). Set `NX_VERBOSE_LOGGING=true` to log when fallback triggers.
 *
 * When native strip is opted out (`NX_PREFER_NODE_STRIP_TYPES=false` or
 * unsupported Node), uses the legacy `registerTsProject` path.
 *
 * `tsConfigPath` is only consulted on the swc/ts-node fallback path (for
 * compilerOptions) and for tsconfig-paths registration. Native strip ignores
 * it. When omitted, defaults to the workspace root tsconfig.
 *
 * Note on ESM: Node 22.12+ supports `require()` of synchronous ESM by default,
 * so most ESM `.ts` configs load via this function without issue. Modules
 * that use top-level await throw `ERR_REQUIRE_ASYNC_MODULE` and must be
 * loaded with dynamic `import()` instead. `ERR_REQUIRE_ESM` (legacy code)
 * bubbles unchanged for the rare case it still fires, so async-aware callers
 * can dispatch to `import()`.
 *
 * @returns the loaded module
 */
export function loadTsFile<T = any>(
  filePath: string,
  tsConfigPath?: string
): T {
  const resolvedTsConfigPath = tsConfigPath ?? getRootTsConfigPath();

  if (isInvokedByTsx) {
    return require(filePath) as T;
  }

  if (!preferNodeStripTypes) {
    if (!resolvedTsConfigPath) {
      throw new Error(
        `${NX_PREFIX} loadTsFile could not find a workspace tsconfig while loading ${filePath} on the swc/ts-node path. Pass an explicit tsConfigPath or add a tsconfig.base.json/tsconfig.json at the workspace root.`
      );
    }
    const cleanup = registerTsProject(resolvedTsConfigPath);
    try {
      return require(filePath) as T;
    } finally {
      cleanup();
    }
  }

  // Native strip path: no registration up front. pnpm/npm/yarn workspaces
  // resolve aliases without tsconfig-paths. On failure, lazy-register what
  // the specific error code indicates is needed and retry:
  //   - MODULE_NOT_FOUND -> first try tsconfig-paths (alias resolution).
  //     If that still fails (e.g. extensionless `import './foo'` when
  //     `foo.ts` is adjacent - Node's resolver doesn't add `.ts`), escalate
  //     to swc/ts-node which handles `.ts` extension resolution.
  //   - ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX -> register swc/ts-node + tsconfig-paths
  // Each registration kind runs at most once, so a file recovers in at
  // most three attempts.
  let pathsRegistered = false;
  let transpilerRegistered = false;
  const cleanups: Array<() => void> = [];

  const registerTranspilerFallback = (err: unknown) => {
    if (!swcNodeInstalled && !tsNodeInstalled) {
      const original = err instanceof Error ? err.message : String(err);
      throw new Error(
        `${NX_PREFIX} ${filePath} could not be loaded under Node's native TypeScript stripping (${original}). Install @swc-node/register and @swc/core (or ts-node) to enable the swc/ts-node fallback, or ${STRIP_TYPES_OPT_OUT_HINT}`
      );
    }
    if (!resolvedTsConfigPath) {
      throw new Error(
        `${NX_PREFIX} ${filePath} requires the swc/ts-node fallback but no workspace tsconfig was found. Pass an explicit tsConfigPath or add a tsconfig.base.json/tsconfig.json at the workspace root. ${STRIP_TYPES_OPT_OUT_HINT}`
      );
    }
    if (!pathsRegistered && !disableTsConfigPaths) {
      cleanups.push(registerTsConfigPaths(resolvedTsConfigPath));
      pathsRegistered = true;
    }
    const { compilerOptions, tsConfigRaw } =
      readCompilerOptions(resolvedTsConfigPath);
    cleanups.push(registerTranspiler(compilerOptions, tsConfigRaw));
    transpilerRegistered = true;
  };

  try {
    for (let attempt = 1; ; attempt++) {
      try {
        if (attempt > 1) {
          try {
            delete require.cache[require.resolve(filePath)];
          } catch {
            // require.resolve may throw if the failed load never reached cache
          }
        }
        return require(filePath) as T;
      } catch (err) {
        // Cheap fallback first: register tsconfig-paths and retry.
        if (
          isModuleNotFoundError(err) &&
          !pathsRegistered &&
          !disableTsConfigPaths &&
          resolvedTsConfigPath
        ) {
          logFallback(
            filePath,
            err,
            'Module not found; registering tsconfig-paths and retrying.'
          );
          cleanups.push(registerTsConfigPaths(resolvedTsConfigPath));
          pathsRegistered = true;
          continue;
        }

        // Heavy fallback: register swc/ts-node (+ paths) and retry. Triggered
        // by:
        //   - strip-types failure (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`)
        //   - module resolution failure that tsconfig-paths alone can't fix
        //     (extensionless `./foo` -> `./foo.ts`)
        //   - SyntaxError in a `.cts`/`.cjs` file (ESM syntax in a forced-CJS
        //     file). swc-node compiles ESM->CJS regardless of extension.
        //   - SyntaxError from Node parsing a `.ts` config with ESM syntax as
        //     CJS. swc/ts-node preserves the pre-v23 behavior for these files.
        //   - ReferenceError from Node treating a `.ts`/`.mts` config as ESM
        //     when it contains legacy CJS `require`.
        //   - SyntaxError from native ESM linkage when generated TS config
        //     imports a type-only symbol as a runtime named export.
        if (
          (isNativeTypeStripError(err) ||
            isModuleNotFoundError(err) ||
            isCjsSyntaxError(err, filePath) ||
            isTsEsmSyntaxError(err, filePath) ||
            isRequireInEsmScopeError(err, filePath) ||
            isTsEsmNamedExportLinkageError(err, filePath)) &&
          !transpilerRegistered
        ) {
          logFallback(
            filePath,
            err,
            isNativeTypeStripError(err)
              ? 'Native Node.js TypeScript stripping failed; falling back to swc/ts-node + tsconfig-paths.'
              : isCjsSyntaxError(err, filePath)
                ? 'ESM syntax in forced-CJS file; falling back to swc/ts-node + tsconfig-paths.'
                : isTsEsmSyntaxError(err, filePath)
                  ? 'ESM syntax in TypeScript file parsed as CommonJS; falling back to swc/ts-node + tsconfig-paths.'
                  : isRequireInEsmScopeError(err, filePath)
                    ? 'CommonJS require in native ESM TypeScript file; falling back to swc/ts-node + tsconfig-paths.'
                    : isTsEsmNamedExportLinkageError(err, filePath)
                      ? 'Native ESM named export linkage failed; falling back to swc/ts-node + tsconfig-paths.'
                      : 'Module not found after tsconfig-paths; falling back to swc/ts-node + tsconfig-paths.'
          );
          registerTranspilerFallback(err);
          continue;
        }

        throw augmentLoadFailure(filePath, err);
      }
    }
  } finally {
    for (const fn of cleanups) fn();
  }
}

/**
 * Plain `require()` with a lazy `tsconfig-paths` fallback. Use for files that
 * are NOT TypeScript (no transpilation needed) but may still import workspace
 * packages through TS path aliases (e.g. a `.js` changelog renderer that
 * `require`s `@my-org/lib`).
 *
 * `tsconfig-paths` is only registered after the first `require()` fails with
 * a module-resolution error, so workspaces that resolve aliases through
 * package-manager symlinks pay nothing. Set `NX_DISABLE_TSCONFIG_PATHS=true`
 * to skip the fallback entirely.
 *
 * @returns the loaded module
 */
export function requireWithTsconfigFallback<T = any>(
  filePath: string,
  tsConfigPath?: string
): T {
  try {
    return require(filePath) as T;
  } catch (err) {
    if (!isModuleNotFoundError(err) || disableTsConfigPaths) {
      throw err;
    }
    const resolvedTsConfigPath = tsConfigPath ?? getRootTsConfigPath();
    if (!resolvedTsConfigPath) {
      throw err;
    }
    const cleanup = registerTsConfigPaths(resolvedTsConfigPath);
    try {
      delete require.cache[require.resolve(filePath)];
    } catch {
      // require.resolve may throw if the failed load never reached cache
    }
    try {
      return require(filePath) as T;
    } finally {
      cleanup();
    }
  }
}

/**
 * Append the `NX_PREFER_NODE_STRIP_TYPES=false` opt-out hint so users know
 * there's an escape hatch for cases native strip can't reach (e.g. ESM with
 * top-level await + unsupported TS syntax). Skipped for:
 *   - ESM-redispatch signals callers expect to handle
 *     (`ERR_REQUIRE_ESM`, `ERR_REQUIRE_ASYNC_MODULE`)
 *   - plain module-resolution failures (`MODULE_NOT_FOUND`,
 *     `ERR_MODULE_NOT_FOUND`) - disabling strip-types doesn't fix a missing
 *     module, the hint just misleads.
 */
function augmentLoadFailure(filePath: string, err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  const code = (err as { code?: string }).code;
  if (
    code === 'ERR_REQUIRE_ESM' ||
    code === 'ERR_REQUIRE_ASYNC_MODULE' ||
    code === 'MODULE_NOT_FOUND' ||
    code === 'ERR_MODULE_NOT_FOUND'
  ) {
    return err;
  }
  if (err.message.includes(NX_PREFER_NODE_STRIP_TYPES_DOCS_URL)) {
    return err;
  }
  err.message = `${err.message}\n\n${NX_PREFIX} Failed to load ${filePath} under Node's native TypeScript stripping. ${STRIP_TYPES_OPT_OUT_HINT}`;
  return err;
}

function logFallback(filePath: string, err: unknown, summary: string): void {
  if (process.env.NX_VERBOSE_LOGGING !== 'true') {
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.warn(
    stripIndent(`${NX_PREFIX} ${summary} (${filePath})
  ${message}`)
  );
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
  compilerOptions: CompilerOptions,
  tsConfigRaw?: unknown
): () => void {
  // Function to register transpiler that returns cleanup function
  const transpiler = getTranspiler(compilerOptions, tsConfigRaw);

  if (!transpiler) {
    // If Node.js natively supports TypeScript (22.6+), no transpiler is needed.
    // Don't warn - Node will handle .ts files via type stripping.
    if (!nodeSupportsNativeTypescript) {
      warnNoTranspiler();
    }
    return () => {};
  }

  return transpiler();
}

/**
 * TypeScript file extensions that must be registered so Node's CJS loader
 * includes them in directory/extensionless `require.resolve` searches.
 * Node's native type-stripping handles actual execution; these stubs only
 * make the extensions visible to the resolver.
 */
const TS_RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'] as const;

/**
 * Register TypeScript file extensions as passthrough stubs in
 * `require.extensions`. This is the minimal action needed so that CJS
 * `require.resolve` can find `.ts` files (e.g. `./rule/index.ts` via
 * directory resolution) without registering a full transpiler.
 *
 * Idempotent: already-registered extensions are left untouched.
 *
 * @param extensionsRegistry The `require.extensions` map to register into.
 *   Defaults to the module-local `require.extensions`. Overridable for tests.
 * @returns cleanup function that removes the stubs added by this call
 */
export function registerTsExtensionsForResolution(
  extensionsRegistry: NodeJS.RequireExtensions = require.extensions
): () => void {
  const addedExtensions: string[] = [];

  // Prefer the default `.js` handler as a passthrough. Node's native
  // type-stripping runs before the CJS hook chain on Node 22.6+, so by
  // the time this handler is called the TypeScript syntax is already
  // stripped and the `.js` handler compiles the result as CommonJS.
  // Fall back to a no-op handler when running in environments (e.g. Jest)
  // where `require.extensions['.js']` is not exposed — the stub's mere
  // presence in `require.extensions` is what makes the extension resolvable.
  const jsHandler: NodeJS.RequireExtensions[string] =
    extensionsRegistry['.js'] ??
    ((mod: NodeModule, filename: string) => mod.load(filename));

  for (const ext of TS_RESOLUTION_EXTENSIONS) {
    if (!extensionsRegistry[ext]) {
      extensionsRegistry[ext] = jsHandler;
      addedExtensions.push(ext);
    }
  }

  return () => {
    for (const ext of addedExtensions) {
      delete extensionsRegistry[ext];
    }
  };
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
    const tsconfigPaths = loadTsConfigPaths();
    const tsConfigResult = tsconfigPaths.loadConfig(tsConfigPath);
    /**
     * Register the custom workspace path mappings with node so that workspace libraries
     * can be imported and used within project
     */
    if (tsConfigResult.resultType === 'success') {
      // Short-circuit when the tsconfig has no `paths` entries. Installing
      // tsconfig-paths' resolver hook adds a per-require cost on every
      // module load; in package-manager-workspace setups (which resolve via
      // symlinks instead of TS path mappings), the hook never has anything
      // to do. Avoid paying that overhead on workspaces that don't use
      // `paths`.
      if (
        !tsConfigResult.paths ||
        Object.keys(tsConfigResult.paths).length === 0
      ) {
        return () => {};
      }
      return tsconfigPaths.register({
        baseUrl: resolvePathsBaseUrl(tsConfigPath),
        paths: tsConfigResult.paths,
      });
    }
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Unable to load ${tsConfigPath}: ` + err.message);
    }
  }
  throw new Error(`Unable to load ${tsConfigPath}`);
}

function readCompilerOptions(tsConfigPath): {
  compilerOptions: CompilerOptions;
  tsConfigRaw?: unknown;
} {
  const preferTsNode = process.env.NX_PREFER_TS_NODE === 'true';

  if (swcNodeInstalled && !preferTsNode) {
    return {
      compilerOptions: readCompilerOptionsWithSwc(tsConfigPath),
    };
  } else {
    return readCompilerOptionsWithTypescript(tsConfigPath);
  }
}

function readCompilerOptionsWithSwc(tsConfigPath) {
  const {
    readDefaultTsConfig,
  }: typeof import('@swc-node/register/read-default-tsconfig') = require('@swc-node/register/read-default-tsconfig');
  const compilerOptions = readDefaultTsConfig(tsConfigPath);
  // This is returned in compiler options for some reason, but not part of the typings.
  // @swc-node/register filters the files to transpile based on it, but it can be limiting when processing
  // files not part of the received tsconfig included files (e.g. shared helpers, or config files not in source, etc.).
  delete compilerOptions.files;

  // @swc-node/register's readDefaultTsConfig auto-sets baseUrl to the
  // dirname of the tsconfig when not explicitly configured. This is incorrect
  // when paths are inherited via "extends" from a parent tsconfig at a
  // different directory level (e.g., tsconfig.base.json at workspace root),
  // because SWC will resolve "./"-prefixed paths relative to the wrong
  // directory. Use the workspace root as baseUrl in that case.
  // baseUrl will not be configured when using newer versions of TypeScript like `tsgo`.
  if (compilerOptions.paths) {
    const { options: tsOptions } = readTsConfigWithoutFiles(tsConfigPath);
    if (!tsOptions.baseUrl) {
      compilerOptions.baseUrl = workspaceRoot;
    }
  }

  return compilerOptions;
}

function readCompilerOptionsWithTypescript(tsConfigPath) {
  const { options, raw } = readTsConfigWithoutFiles(tsConfigPath);
  // This property is returned in compiler options for some reason, but not part of the typings.
  // ts-node fails on unknown props, so we have to remove it.
  delete options.configFilePath;

  return {
    compilerOptions: options,
    tsConfigRaw: raw,
  };
}

function loadTsConfigPaths(): typeof import('tsconfig-paths') | null {
  try {
    return require('tsconfig-paths');
  } catch {
    warnNoTsconfigPaths();
  }
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

function resolvePathsBaseUrl(tsconfigPath: string): string {
  const chain: { dir: string; raw: any }[] = [];
  const queue: string[] = [tsconfigPath];
  while (queue.length > 0) {
    const absolute = resolve(queue.shift()!);
    const dir = dirname(absolute);
    try {
      const raw = JSON.parse(readFileSync(absolute, 'utf-8'));
      chain.push({ dir, raw });
      const exts: string[] = raw.extends
        ? Array.isArray(raw.extends)
          ? raw.extends
          : [raw.extends]
        : [];
      for (const ext of exts) {
        const resolved = resolveExtendsPath(ext, dir);
        if (resolved) {
          queue.push(resolved);
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  let pathsIndex = -1;
  for (let i = 0; i < chain.length; i++) {
    if (
      chain[i].raw.compilerOptions?.paths &&
      Object.keys(chain[i].raw.compilerOptions.paths).length > 0
    ) {
      pathsIndex = i;
      break;
    }
  }

  const searchStart = pathsIndex >= 0 ? pathsIndex : 0;
  for (let i = searchStart; i < chain.length; i++) {
    if (chain[i].raw.compilerOptions?.baseUrl) {
      return resolve(chain[i].dir, chain[i].raw.compilerOptions.baseUrl);
    }
  }

  return pathsIndex >= 0
    ? chain[pathsIndex].dir
    : dirname(resolve(tsconfigPath));
}

function resolveExtendsPath(ext: string, fromDir: string): string | null {
  if (ext.startsWith('.') || isAbsolute(ext)) {
    let resolved = resolve(fromDir, ext);
    if (existsSync(resolved)) return resolved;
    if (!resolved.endsWith('.json')) {
      resolved += '.json';
      if (existsSync(resolved)) return resolved;
    }
    return null;
  }
  try {
    return require.resolve(ext, { paths: [fromDir] });
  } catch {
    try {
      return require.resolve(`${ext}/tsconfig.json`, { paths: [fromDir] });
    } catch {
      return null;
    }
  }
}
