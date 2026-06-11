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

/**
 * Source of a minimal ESM resolution hook that rewrites TypeScript NodeNext
 * `.js`/`.mjs`/`.cjs` relative specifiers to their `.ts`/`.mts`/`.cts` sources.
 * Inlined as a string so it can be registered as a self-contained `data:`
 * module - it relies only on Node's default resolver (no ts-node/swc-node) and
 * defers loading to Node's native TypeScript stripping. The ESM counterpart to
 * the CJS `ensureCjsResolverPatched`.
 *
 * Only rewrites when the default resolution fails with ERR_MODULE_NOT_FOUND,
 * the importing module is itself TypeScript, and the specifier is relative, so
 * it never hijacks resolution that would otherwise succeed.
 *
 * Exported so the hook can be exercised directly in unit tests.
 */
export const NODENEXT_ESM_RESOLVER_SOURCE = `
const EXT_FALLBACK = { '.js': ['.ts', '.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };
const TS_PARENT_RE = /\\.(?:ts|tsx|mts|cts)(?:$|\\?)/;
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    const parent = context.parentURL;
    if (!parent || !TS_PARENT_RE.test(parent)) throw err;
    if (!(specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('file:'))) throw err;
    const m = specifier.match(/(\\.(?:js|mjs|cjs))($|\\?)/);
    if (!m) throw err;
    const fallbacks = EXT_FALLBACK[m[1]];
    if (!fallbacks) throw err;
    const base = specifier.slice(0, m.index);
    const suffix = specifier.slice(m.index + m[1].length);
    for (const ext of fallbacks) {
      try { return await nextResolve(base + ext + suffix, context); } catch {}
    }
    throw err;
  }
}
`;

let nodeNextEsmResolverRegistered = false;

/**
 * Register a self-contained ESM resolution hook (via `Module.register`) that
 * rewrites TypeScript NodeNext-style `.js`/`.mjs`/`.cjs` relative specifiers to
 * their `.ts`/`.mts`/`.cts` sources. This is the ESM counterpart to
 * `ensureCjsResolverPatched`: Node's native type stripping loads the `.ts`
 * file, but neither native strip nor Node's ESM resolver rewrites the
 * extension, so `import './foo.js'` from a `.ts` source where only `foo.ts`
 * exists fails with ERR_MODULE_NOT_FOUND without it.
 *
 * The hook is inlined as a `data:` module (see `NODENEXT_ESM_RESOLVER_SOURCE`)
 * and relies only on Node's default resolver, so it needs no ts-node/swc-node.
 *
 * Idempotent and best-effort: a no-op when `Module.register` is unavailable,
 * when a TypeScript transpiler is already preloaded (see
 * `isTsTranspilerPreloaded`), or if registration fails.
 */
export function ensureNodeNextEsmResolverRegistered(): void {
  if (nodeNextEsmResolverRegistered) return;
  nodeNextEsmResolverRegistered = true;

  const module = require('node:module') as typeof import('node:module');
  if (typeof module.register !== 'function') return;

  // Skip when a transpiler was preloaded via `--require`/`--import` (e.g.
  // `--require ts-node/register`, which Nx uses only when it runs from `.ts`
  // source). `module.register()` spins up a loader-hook worker thread on which
  // Node re-runs those preloads, resolved relative to the *current* working
  // directory - and Nx plugin workers `chdir()` into the analyzed workspace
  // first. If that workspace can't resolve the preloaded module, the loader
  // worker throws and can leave module resolution in a bad state, so we must
  // avoid the call entirely; catching it is not a clean recovery.
  //
  // Consequence: in that from-`.ts`-source invocation a `type: module` plugin
  // using NodeNext `.js` specifiers won't get this resolver (a preloaded
  // `ts-node` does NOT rewrite `.js` -> `.ts` for ESM). Published Nx is
  // unaffected - its workers run compiled `.js` with no preload.
  if (isTsTranspilerPreloaded()) return;

  try {
    module.register(
      'data:text/javascript,' + encodeURIComponent(NODENEXT_ESM_RESOLVER_SOURCE)
    );
  } catch {
    // Best-effort: leave Node's native handling in place for the
    // dynamic-import path rather than failing the load.
  }
}

/**
 * Whether this process was started with a TypeScript transpiler preloaded via
 * a `--require`/`--import`/`--loader` flag (e.g. `--require ts-node/register`),
 * either directly in `process.execArgv` or through `NODE_OPTIONS`. Used to skip
 * a redundant ESM loader registration that would otherwise crash a loader-hook
 * worker re-running the preload from a `chdir()`'d cwd - see
 * `ensureNodeNextEsmResolverRegistered`.
 */
function isTsTranspilerPreloaded(): boolean {
  const PRELOAD_FLAGS = [
    '-r',
    '--require',
    '--import',
    '--loader',
    '--experimental-loader',
  ];
  const TRANSPILER_RE = /(?:ts-node|@?swc-node)/;

  // Flags passed directly (e.g. spawn(..., ['--require', 'ts-node/register'])).
  const execArgv = process.execArgv ?? [];
  for (let i = 0; i < execArgv.length; i++) {
    const arg = execArgv[i];
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      if (
        PRELOAD_FLAGS.includes(arg.slice(0, eqIdx)) &&
        TRANSPILER_RE.test(arg.slice(eqIdx + 1))
      ) {
        return true;
      }
    } else if (
      PRELOAD_FLAGS.includes(arg) &&
      TRANSPILER_RE.test(execArgv[i + 1] ?? '')
    ) {
      return true;
    }
  }

  // Preloads passed via NODE_OPTIONS don't surface in execArgv.
  const nodeOptions = process.env.NODE_OPTIONS;
  if (
    nodeOptions &&
    TRANSPILER_RE.test(nodeOptions) &&
    PRELOAD_FLAGS.some((flag) => nodeOptions.includes(flag))
  ) {
    return true;
  }

  return false;
}

let cjsResolverPatched = false;

/**
 * Patches Node's CJS resolver to fall back from `.js`/`.mjs`/`.cjs` to the
 * corresponding TypeScript source extension (`.ts`/`.tsx`, `.mts`, `.cts`)
 * when the requesting file is itself a `.ts`/`.tsx`/`.mts`/`.cts` source.
 *
 * Required for TypeScript NodeNext-style relative imports: `import './foo.js'`
 * inside a `.ts` file resolves to `./foo.ts` at compile time, but the `.js`
 * specifier survives transpilation to CJS. Node's native CJS resolver doesn't
 * rewrite extensions and there is no officially-supported Node API for this —
 * Node's native strip-types deliberately doesn't either — so a resolver patch
 * is the prevailing solution in the ecosystem (used by `tsx` and ts-node's
 * `experimentalResolver`).
 *
 * Patches `Module._resolveFilename` (not `_findPath`, matching tsx's narrower
 * surface). Gates on the requesting file being TS so vanilla `.js` code
 * requesting missing `.js` files keeps failing — no silent hijack. Only fires
 * the fallback on `MODULE_NOT_FOUND` so existing `.js` resolution is
 * unaffected when both files exist. Idempotent on repeat calls.
 */
export function ensureCjsResolverPatched(): void {
  if (cjsResolverPatched) return;
  cjsResolverPatched = true;

  const Module = require('node:module') as typeof import('node:module');
  const original = (Module as any)._resolveFilename;
  if (typeof original !== 'function') return;

  const TS_PARENT_RE = /\.(?:ts|tsx|mts|cts)$/;
  const EXT_FALLBACK: Record<string, string[]> = {
    '.js': ['.ts', '.tsx'],
    '.mjs': ['.mts'],
    '.cjs': ['.cts'],
  };

  (Module as any)._resolveFilename = function (
    this: unknown,
    request: string,
    parent: { filename?: string } | undefined,
    ...rest: unknown[]
  ): string {
    try {
      return original.call(this, request, parent, ...rest);
    } catch (err: any) {
      if (err?.code !== 'MODULE_NOT_FOUND') throw err;
      if (!parent?.filename || !TS_PARENT_RE.test(parent.filename)) throw err;

      const match = request.match(/(\.(?:js|mjs|cjs))$/);
      if (!match) throw err;
      const fallbacks = EXT_FALLBACK[match[1]];
      if (!fallbacks) throw err;

      const base = request.slice(0, -match[1].length);
      for (const ext of fallbacks) {
        try {
          return original.call(this, base + ext, parent, ...rest);
        } catch {
          // try the next fallback
        }
      }
      throw err;
    }
  };
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
 * Setting NX_PREFER_TS_NODE=true also opts out, since that flag explicitly
 * requests ts-node for transpilation.
 *
 * See: https://nodejs.org/api/typescript.html#full-typescript-support
 */
const preferNodeStripTypes: boolean = (() => {
  if (!nodeSupportsNativeTypescript) {
    return false;
  }
  if (process.env.NX_PREFER_TS_NODE === 'true') {
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
 * This function registers either ts-node or swc-node to transpile TypeScript files on the fly.
 * It also registers tsconfig-paths to handle path mapping based on the provided tsconfig.
 *
 * The TypeScript transpiler registration is done regardless of NX_PREFER_NODE_STRIP_TYPES.
 * If you want to skip transpiler registration, it is recommended that you check `process.features.typescript`.
 *
 * @returns cleanup function
 */
export function registerTsProject(tsConfigPath: string): () => void {
  // See explanation alongside isInvokedByTsx declaration
  if (isInvokedByTsx) {
    return () => {};
  }

  const { compilerOptions, tsConfigRaw } = readCompilerOptions(tsConfigPath);

  const cleanupFunctions: ((...args: unknown[]) => unknown)[] = [
    registerTsConfigPaths(tsConfigPath),
    registerTranspiler(compilerOptions, tsConfigRaw),
  ];

  // Best-effort ESM loader registration so dynamic import() of .ts/.mts
  // files goes through a transpiler. No-op if no ESM loader package is
  // installed.
  ensureEsmLoaderRegistered({ required: false });
  // CJS-side fallback so NodeNext `.js` specifiers in `.ts` sources resolve
  // to the matching `.ts` file when require()'d.
  ensureCjsResolverPatched();

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
