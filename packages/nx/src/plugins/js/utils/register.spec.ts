import type { MockInstance } from 'vitest';
import type { CompilerOptions } from 'typescript';
import { JsxEmit, ModuleKind, ScriptTarget } from 'typescript';
import {
  getTranspiler,
  getTsNodeCompilerOptions,
  isCjsSyntaxError,
  isNativeTypeStripError,
  isRequireInEsmScopeError,
  isTsEsmNamedExportLinkageError,
  isTsEsmSyntaxError,
  NODENEXT_ESM_RESOLVER_SOURCE,
  nodeNextEsmResolveHook,
  refreshSourceGraphResolvers,
  registerSourceGraphResolver,
  callResolveFilename,
  resolveTsNodeEsmCompilerOptions,
} from './register';
import * as typescriptUtils from './typescript';

// Avoid a real swc registration side effect when exercising getTranspiler.
// The source loads this with a bare require (CJS channel), so stub the
// require cache rather than vi.mock.
import { createRequire, Module } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, sep } from 'node:path';
import { mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import {
  mockCjsModule,
  resetCjsMocks,
} from '../../../internal-testing-utils/cjs-mock';
import { TempFs } from '../../../internal-testing-utils/temp-fs';

function linkWorkspacePackages(base: string, dirs: string[]) {
  mkdirSync(join(base, 'node_modules/@proj'), { recursive: true });
  for (const dir of dirs) {
    symlinkSync(
      join(base, 'packages', dir),
      join(base, 'node_modules/@proj', dir),
      'dir'
    );
  }
}
{
  const req = createRequire(import.meta.url);
  const modPath = req.resolve('@swc-node/register/register');
  const stub = new (Module as any)(modPath);
  stub.exports = { register: () => () => {} };
  stub.loaded = true;
  req.cache[modPath] = stub;
}

describe('getTsNodeCompilerOptions', () => {
  it('should replace enum value with enum key for module', () => {
    expect(
      getTsNodeCompilerOptions({
        module: ModuleKind.CommonJS,
      }).module
    ).toEqual('CommonJS');
  });

  it('should replace enum value with enum key for target', () => {
    expect(
      getTsNodeCompilerOptions({
        target: ScriptTarget.ES2020,
      }).target
    ).toEqual('ES2020');
  });

  it('should remove jsx option', () => {
    expect(
      getTsNodeCompilerOptions({
        jsx: JsxEmit.ReactJSX,
      }).jsx
    ).toBeUndefined();
  });

  it('should use correct lib value', () => {
    expect(
      getTsNodeCompilerOptions({
        lib: ['lib.es2022.d.ts'],
      }).lib
    ).toEqual(['es2022']);
  });
});

describe('isNativeStripPreferred', () => {
  const originalEnv = { ...process.env };
  const featuresDescriptor = Object.getOwnPropertyDescriptor(
    process.features,
    'typescript'
  );

  function setNativeTypescriptSupport(value: 'strip' | 'transform' | false) {
    Object.defineProperty(process.features, 'typescript', {
      value,
      configurable: true,
    });
  }

  async function loadIsNativeStripPreferred(): boolean {
    let result: boolean;
    vi.resetModules();
    result = (await import('./register')).isNativeStripPreferred();
    return result;
  }

  afterEach(() => {
    process.env = { ...originalEnv };
    if (featuresDescriptor) {
      Object.defineProperty(process.features, 'typescript', featuresDescriptor);
    } else {
      delete (process.features as { typescript?: unknown }).typescript;
    }
  });

  it('prefers native strip when the runtime supports it', async () => {
    setNativeTypescriptSupport('strip');
    delete process.env.NX_PREFER_TS_NODE;
    delete process.env.NX_PREFER_NODE_STRIP_TYPES;
    expect(await loadIsNativeStripPreferred()).toBe(true);
  });

  it('does not prefer native strip when the runtime lacks support', async () => {
    setNativeTypescriptSupport(false);
    delete process.env.NX_PREFER_TS_NODE;
    delete process.env.NX_PREFER_NODE_STRIP_TYPES;
    expect(await loadIsNativeStripPreferred()).toBe(false);
  });

  it('does not prefer native strip when NX_PREFER_NODE_STRIP_TYPES is false', async () => {
    setNativeTypescriptSupport('strip');
    process.env.NX_PREFER_NODE_STRIP_TYPES = 'false';
    expect(await loadIsNativeStripPreferred()).toBe(false);
  });

  it('does not prefer native strip when NX_PREFER_TS_NODE is true', async () => {
    setNativeTypescriptSupport('strip');
    process.env.NX_PREFER_TS_NODE = 'true';
    delete process.env.NX_PREFER_NODE_STRIP_TYPES;
    expect(await loadIsNativeStripPreferred()).toBe(false);
  });
});

describe('getTranspiler', () => {
  // Each case swaps the lazily-required `typescript`; drop the swap afterwards
  // so the doctored version does not leak into later tests in this file.
  afterEach(() => {
    resetCjsMocks();
  });

  // TS6 requires the suppression flag to avoid hard-erroring on deprecated options.
  it('sets ignoreDeprecations to "6.0" on TypeScript >= 6', async () => {
    vi.resetModules();
    // register.ts lazy-requires typescript (CJS channel); replace it there.
    mockCjsModule(import.meta.url, 'typescript', {
      ...require('typescript'),
      versionMajorMinor: '6.0',
    });
    const { getTranspiler: fresh } =
      (await import('./register')) as typeof import('./register');
    const opts: CompilerOptions = {};
    fresh(opts);
    expect(opts.ignoreDeprecations).toEqual('6.0');
  });

  // TS5 rejects the '6.0' value (TS5103) so the option must stay absent.
  it('leaves ignoreDeprecations unset on TypeScript < 6', async () => {
    vi.resetModules();
    mockCjsModule(import.meta.url, 'typescript', {
      ...require('typescript'),
      versionMajorMinor: '5.9',
    });
    const { getTranspiler: fresh } =
      (await import('./register')) as typeof import('./register');
    const opts: CompilerOptions = {};
    fresh(opts);
    expect(opts.ignoreDeprecations).toBeUndefined();
  });
});

describe('isNativeTypeStripError', () => {
  it('returns true for ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX', () => {
    const err = Object.assign(new Error('boom'), {
      code: 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX',
    });
    expect(isNativeTypeStripError(err)).toBe(true);
  });

  it('returns false for unrelated error codes', () => {
    expect(
      isNativeTypeStripError(
        Object.assign(new Error(), { code: 'ERR_REQUIRE_ESM' })
      )
    ).toBe(false);
    expect(
      isNativeTypeStripError(
        Object.assign(new Error(), { code: 'MODULE_NOT_FOUND' })
      )
    ).toBe(false);
  });

  it('returns false for non-error inputs', () => {
    expect(isNativeTypeStripError(null)).toBe(false);
    expect(isNativeTypeStripError(undefined)).toBe(false);
    expect(isNativeTypeStripError('boom')).toBe(false);
    expect(isNativeTypeStripError(new Error('no code'))).toBe(false);
  });
});

describe('isCjsSyntaxError', () => {
  it('returns true for SyntaxError thrown while parsing a .cts file', () => {
    expect(
      isCjsSyntaxError(
        new SyntaxError("Unexpected token 'export'"),
        '/abs/path/jest.config.cts'
      )
    ).toBe(true);
  });

  it('returns true for SyntaxError thrown while parsing a .cjs file', () => {
    expect(
      isCjsSyntaxError(
        new SyntaxError("Unexpected token 'export'"),
        '/abs/path/jest.config.cjs'
      )
    ).toBe(true);
  });

  it('returns false for non-CJS extensions (.ts/.mts/.js/.mjs)', () => {
    const err = new SyntaxError("Unexpected token 'export'");
    expect(isCjsSyntaxError(err, '/abs/jest.config.ts')).toBe(false);
    expect(isCjsSyntaxError(err, '/abs/jest.config.mts')).toBe(false);
    expect(isCjsSyntaxError(err, '/abs/jest.config.js')).toBe(false);
    expect(isCjsSyntaxError(err, '/abs/jest.config.mjs')).toBe(false);
  });

  it('returns false for non-SyntaxError inputs', () => {
    expect(isCjsSyntaxError(new Error('boom'), '/x.cts')).toBe(false);
    expect(isCjsSyntaxError(null, '/x.cts')).toBe(false);
    expect(isCjsSyntaxError('boom', '/x.cts')).toBe(false);
  });
});

describe('isRequireInEsmScopeError', () => {
  it('returns true for require ReferenceError thrown while loading a .ts file as ESM', () => {
    expect(
      isRequireInEsmScopeError(
        new ReferenceError('require is not defined in ES module scope'),
        '/abs/path/webpack.config.prod.ts'
      )
    ).toBe(true);
  });

  it('returns true for require ReferenceError thrown while loading a .mts file as ESM', () => {
    expect(
      isRequireInEsmScopeError(
        new ReferenceError('require is not defined in ES module scope'),
        '/abs/path/webpack.config.mts'
      )
    ).toBe(true);
  });

  it('returns false for non-TS extensions', () => {
    const err = new ReferenceError('require is not defined in ES module scope');
    expect(isRequireInEsmScopeError(err, '/abs/webpack.config.js')).toBe(false);
    expect(isRequireInEsmScopeError(err, '/abs/webpack.config.cjs')).toBe(
      false
    );
  });

  it('returns false for unrelated errors', () => {
    expect(
      isRequireInEsmScopeError(new ReferenceError('missing'), '/x.ts')
    ).toBe(false);
    expect(isRequireInEsmScopeError(new Error('boom'), '/x.ts')).toBe(false);
    expect(isRequireInEsmScopeError(null, '/x.ts')).toBe(false);
  });
});

describe('isTsEsmSyntaxError', () => {
  it('returns true for import SyntaxError thrown while loading a .ts file as CJS', () => {
    expect(
      isTsEsmSyntaxError(
        new SyntaxError('Cannot use import statement outside a module'),
        '/abs/path/cypress.config.ts'
      )
    ).toBe(true);
  });

  it('returns false for non-.ts files and unrelated syntax errors', () => {
    const err = new SyntaxError('Cannot use import statement outside a module');
    expect(isTsEsmSyntaxError(err, '/abs/cypress.config.cts')).toBe(false);
    expect(isTsEsmSyntaxError(err, '/abs/cypress.config.mts')).toBe(false);
    expect(
      isTsEsmSyntaxError(new SyntaxError('Unexpected token'), '/x.ts')
    ).toBe(false);
    expect(isTsEsmSyntaxError(new Error('boom'), '/x.ts')).toBe(false);
  });
});

describe('isTsEsmNamedExportLinkageError', () => {
  it('returns true for named export SyntaxError thrown while loading a .ts file as ESM', () => {
    expect(
      isTsEsmNamedExportLinkageError(
        new SyntaxError(
          "The requested module '@nx/module-federation' does not provide an export named 'ModuleFederationConfig'"
        ),
        '/abs/path/module-federation.config.ts'
      )
    ).toBe(true);
  });

  it('returns true for named export SyntaxError thrown while loading a .mts file as ESM', () => {
    expect(
      isTsEsmNamedExportLinkageError(
        new SyntaxError(
          "The requested module './module-federation.config' does not provide an export named 'config'"
        ),
        '/abs/path/module-federation.config.mts'
      )
    ).toBe(true);
  });

  it('returns false for non-TS extensions', () => {
    const err = new SyntaxError(
      "The requested module './x' does not provide an export named 'y'"
    );
    expect(isTsEsmNamedExportLinkageError(err, '/abs/config.js')).toBe(false);
    expect(isTsEsmNamedExportLinkageError(err, '/abs/config.cjs')).toBe(false);
  });

  it('returns false for unrelated errors', () => {
    expect(
      isTsEsmNamedExportLinkageError(
        new SyntaxError('Unexpected token'),
        '/x.ts'
      )
    ).toBe(false);
    expect(isTsEsmNamedExportLinkageError(new Error('boom'), '/x.ts')).toBe(
      false
    );
    expect(isTsEsmNamedExportLinkageError(null, '/x.ts')).toBe(false);
  });
});

describe('NodeNext ESM resolve hook (NODENEXT_ESM_RESOLVER_SOURCE)', () => {
  type ResolveHook = (
    specifier: string,
    context: { parentURL?: string },
    nextResolve: (specifier: string, context?: unknown) => Promise<any>
  ) => Promise<{ url: string }>;

  let resolve: ResolveHook;

  beforeAll(async () => {
    // Load the shipped source through the same `data:` module `register()`
    // builds, so the tests exercise what Node actually registers.
    const mod = await import(
      'data:text/javascript,' + encodeURIComponent(NODENEXT_ESM_RESOLVER_SOURCE)
    );
    resolve = mod.resolve;
  });

  const TS_PARENT = 'file:///ws/src/index.ts';

  // Mimics Node's default resolver: resolves specifiers in `existing`, throws
  // ERR_MODULE_NOT_FOUND otherwise. Records every specifier it was asked for.
  function makeNextResolve(existing: string[]) {
    const set = new Set(existing);
    const calls: string[] = [];
    const nextResolve = async (specifier: string) => {
      calls.push(specifier);
      if (set.has(specifier)) {
        return { url: `file:///resolved/${specifier}`, shortCircuit: true };
      }
      throw Object.assign(new Error(`Cannot find module '${specifier}'`), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
    };
    return { nextResolve, calls };
  }

  it('rewrites a NodeNext .js specifier to .ts from a TypeScript parent', async () => {
    const { nextResolve, calls } = makeNextResolve(['./nodes.ts']);
    const result = await resolve(
      './nodes.js',
      { parentURL: TS_PARENT },
      nextResolve
    );
    expect(result.url).toBe('file:///resolved/./nodes.ts');
    // Tried the original first, then the .ts fallback.
    expect(calls).toEqual(['./nodes.js', './nodes.ts']);
  });

  it('rewrites .mjs -> .mts and .cjs -> .cts', async () => {
    const mjs = makeNextResolve(['./a.mts']);
    expect(
      (await resolve('./a.mjs', { parentURL: TS_PARENT }, mjs.nextResolve)).url
    ).toBe('file:///resolved/./a.mts');

    const cjs = makeNextResolve(['./b.cts']);
    expect(
      (await resolve('./b.cjs', { parentURL: TS_PARENT }, cjs.nextResolve)).url
    ).toBe('file:///resolved/./b.cts');
  });

  it('does not hijack when the real .js file resolves', async () => {
    const { nextResolve, calls } = makeNextResolve(['./nodes.js']);
    const result = await resolve(
      './nodes.js',
      { parentURL: TS_PARENT },
      nextResolve
    );
    expect(result.url).toBe('file:///resolved/./nodes.js');
    // No .ts fallback attempt when the .js resolves.
    expect(calls).toEqual(['./nodes.js']);
  });

  it('does not rewrite when the parent is not a TypeScript file', async () => {
    const { nextResolve, calls } = makeNextResolve(['./nodes.ts']);
    await expect(
      resolve(
        './nodes.js',
        { parentURL: 'file:///ws/src/index.js' },
        nextResolve
      )
    ).rejects.toMatchObject({ code: 'ERR_MODULE_NOT_FOUND' });
    expect(calls).toEqual(['./nodes.js']);
  });

  it('ignores bare (non-relative) specifiers', async () => {
    const { nextResolve, calls } = makeNextResolve(['pkg/nodes.ts']);
    await expect(
      resolve('pkg/nodes.js', { parentURL: TS_PARENT }, nextResolve)
    ).rejects.toMatchObject({ code: 'ERR_MODULE_NOT_FOUND' });
    expect(calls).toEqual(['pkg/nodes.js']);
  });

  it('only rewrites .js/.mjs/.cjs, leaving other extensions untouched', async () => {
    const { nextResolve, calls } = makeNextResolve(['./data.ts']);
    await expect(
      resolve('./data.json', { parentURL: TS_PARENT }, nextResolve)
    ).rejects.toMatchObject({ code: 'ERR_MODULE_NOT_FOUND' });
    expect(calls).toEqual(['./data.json']);
  });

  it('rethrows non-MODULE_NOT_FOUND errors untouched', async () => {
    const boom = Object.assign(new SyntaxError('boom'), { code: 'ERR_OTHER' });
    const nextResolve = async () => {
      throw boom;
    };
    await expect(
      resolve('./nodes.js', { parentURL: TS_PARENT }, nextResolve)
    ).rejects.toBe(boom);
  });
});

// The rewrite logic is exhaustively covered above against the shipped source;
// these cases only verify the synchronous transcription used by
// `module.registerHooks()` - `nextResolve` returns/throws synchronously here
// rather than resolving/rejecting a promise.
describe('NodeNext ESM resolve hook (nodeNextEsmResolveHook, sync)', () => {
  const TS_PARENT = 'file:///ws/src/index.ts';

  function makeNextResolve(existing: string[]) {
    const set = new Set(existing);
    const nextResolve = (specifier: string) => {
      if (set.has(specifier)) return { url: `file:///resolved/${specifier}` };
      throw Object.assign(new Error(`Cannot find module '${specifier}'`), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
    };
    return nextResolve;
  }

  it('returns the .ts fallback when the .js specifier is missing', () => {
    const result = nodeNextEsmResolveHook(
      './nodes.js',
      { parentURL: TS_PARENT },
      makeNextResolve(['./nodes.ts'])
    );
    expect(result.url).toBe('file:///resolved/./nodes.ts');
  });

  it('returns the real .js without a fallback attempt when it resolves', () => {
    const result = nodeNextEsmResolveHook(
      './nodes.js',
      { parentURL: TS_PARENT },
      makeNextResolve(['./nodes.js'])
    );
    expect(result.url).toBe('file:///resolved/./nodes.js');
  });

  it('rethrows synchronously when no fallback resolves', () => {
    expect(() =>
      nodeNextEsmResolveHook(
        './nodes.js',
        { parentURL: TS_PARENT },
        makeNextResolve([])
      )
    ).toThrow(expect.objectContaining({ code: 'ERR_MODULE_NOT_FOUND' }));
  });
});

describe('resolveTsNodeEsmCompilerOptions', () => {
  it('defaults to nodenext when no value is inherited', () => {
    expect(JSON.parse(resolveTsNodeEsmCompilerOptions(undefined))).toEqual({
      moduleResolution: 'nodenext',
      module: 'nodenext',
    });
  });

  it('forces nodenext while preserving other inherited options', () => {
    const raw = JSON.stringify({
      moduleResolution: 'node10',
      module: 'commonjs',
      customConditions: null,
      paths: { '@lib': ['libs/lib'] },
    });
    expect(JSON.parse(resolveTsNodeEsmCompilerOptions(raw))).toEqual({
      moduleResolution: 'nodenext',
      module: 'nodenext',
      customConditions: null,
      paths: { '@lib': ['libs/lib'] },
    });
  });

  it.each(['{oops', 'null', '7', 'true', '"hello"', '["commonjs"]'])(
    'passes %s through unchanged for ts-node to handle',
    (raw) => {
      expect(resolveTsNodeEsmCompilerOptions(raw)).toBe(raw);
    }
  );
});

describe('forceRegisterEsmLoader', () => {
  const originalEnv = { ...process.env };
  let registerSpy: MockInstance;

  beforeEach(() => {
    registerSpy = vi
      .spyOn(require('node:module'), 'register')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    registerSpy.mockRestore();
    process.env = { ...originalEnv };
  });

  async function loadForceRegisterEsmLoader(): Promise<() => void> {
    vi.resetModules();
    return (await import('./register')).forceRegisterEsmLoader;
  }

  function registeredSetterOptions(): unknown {
    expect(String(registerSpy.mock.calls[0][0])).toMatch(
      /^data:text\/javascript,/
    );
    const source = decodeURIComponent(
      String(registerSpy.mock.calls[0][0]).replace('data:text/javascript,', '')
    );
    const rhs = source.match(
      /^process\.env\.TS_NODE_COMPILER_OPTIONS = (.*);$/
    )[1];
    return JSON.parse(JSON.parse(rhs));
  }

  it('registers a compiler-options setter module before the ts-node/esm loader', async () => {
    delete process.env.TS_NODE_COMPILER_OPTIONS;

    (await loadForceRegisterEsmLoader())();

    expect(registerSpy).toHaveBeenCalledTimes(2);
    expect(String(registerSpy.mock.calls[1][0])).toMatch(/ts-node\/esm\.mjs$/);
    expect(registeredSetterOptions()).toEqual({
      moduleResolution: 'nodenext',
      module: 'nodenext',
    });
  });

  it('forces nodenext module and resolution over an inherited value', async () => {
    process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
      moduleResolution: 'node10',
      module: 'commonjs',
      customConditions: null,
    });

    (await loadForceRegisterEsmLoader())();

    expect(registeredSetterOptions()).toEqual({
      moduleResolution: 'nodenext',
      module: 'nodenext',
      customConditions: null,
    });
    // Child processes must keep seeing the inherited value.
    expect(process.env.TS_NODE_COMPILER_OPTIONS).toBe(
      JSON.stringify({
        moduleResolution: 'node10',
        module: 'commonjs',
        customConditions: null,
      })
    );
  });

  it('passes a malformed inherited value through for ts-node to reject', async () => {
    process.env.TS_NODE_COMPILER_OPTIONS = '{oops';

    (await loadForceRegisterEsmLoader())();

    const source = decodeURIComponent(
      String(registerSpy.mock.calls[0][0]).replace('data:text/javascript,', '')
    );
    expect(source).toBe('process.env.TS_NODE_COMPILER_OPTIONS = "{oops";');
  });

  it('does not write a default value into the process env', async () => {
    delete process.env.TS_NODE_COMPILER_OPTIONS;

    (await loadForceRegisterEsmLoader())();

    expect(process.env.TS_NODE_COMPILER_OPTIONS).toBeUndefined();
  });
});

// A real `ts-node/esm` registration in a child process. `@swc-node/register`
// loads the TypeScript source there and is hidden from the ESM loader pick so
// `ts-node/esm` is the loader under test.
describe('forceRegisterEsmLoader with ts-node/esm', () => {
  const {
    mkdtempSync,
    realpathSync,
    rmSync,
    writeFileSync,
  } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  let dir: string;

  beforeAll(() => {
    // Real path: the loader reports the resolved url.
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'nx-ts-node-esm-')));
    writeFileSync(
      join(dir, 'config.mts'),
      'export enum Kind { Esm = 1 }\nexport const url = import.meta.url;\n'
    );
    writeFileSync(
      join(dir, 'entry.cjs'),
      `
const Module = require('node:module');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '@swc-node/register/esm') {
    throw Object.assign(new Error('hidden'), { code: 'MODULE_NOT_FOUND' });
  }
  return resolveFilename.call(this, request, ...rest);
};
const { forceRegisterEsmLoader } = require(process.argv[2]);
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'commonjs',
  moduleResolution: 'node10',
});
forceRegisterEsmLoader();
// Kept out of the transpiled source: a CommonJS transform would turn it into
// a require, and the file exists to exercise the ESM loader.
new Function('s', 'return import(s)')(process.argv[3]).then(
  (m) => process.send({ ok: true, url: m.url, kind: m.Kind.Esm }),
  (e) => process.send({ ok: false, message: String(e.diagnosticText ?? e) })
);
`
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads an ESM config despite an inherited CommonJS TS_NODE_COMPILER_OPTIONS', async () => {
    const { fork } = require('node:child_process');
    const { pathToFileURL } = require('node:url');
    const configUrl = pathToFileURL(join(dir, 'config.mts')).href;
    // The child sets the inherited value itself, after its own CommonJS loader
    // has started, so that loader's options play no part.
    const { TS_NODE_COMPILER_OPTIONS, NODE_OPTIONS, ...env } = process.env;
    const child = fork(
      join(dir, 'entry.cjs'),
      [require.resolve('./register'), configUrl],
      {
        cwd: process.cwd(),
        env,
        execArgv: ['--require', '@swc-node/register'],
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      }
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    const result = await new Promise<any>((resolve, reject) => {
      child.once('message', resolve);
      child.once('error', reject);
      child.once('exit', (code) =>
        reject(new Error(`exited with ${code} before replying:\n${stderr}`))
      );
    });
    child.kill();

    expect(result).toEqual({ ok: true, url: configUrl, kind: 1 });
  }, 60_000);
});

describe('registerSourceGraphResolver', () => {
  let tempFs: InstanceType<typeof TempFs>;
  let root: string;
  const fileUrl = (relativePath: string) =>
    pathToFileURL(join(root, relativePath)).href;

  beforeAll(() => {
    tempFs = new TempFs('source-graph-resolver', false);
    root = tempFs.tempDir;
    tempFs.createFilesSync({
      'packages/utils/package.json': JSON.stringify({
        name: '@proj/utils',
        exports: {
          '.': {
            source: {
              require: './src/index.cts',
              default: './src/index.ts',
            },
            default: './dist/index.js',
          },
          './sub': { source: './src/sub.ts', default: './dist/sub.js' },
        },
      }),
      'packages/utils/src/index.ts': '',
      'packages/utils/src/index.cts': '',
      'packages/utils/src/sub.ts': '',
      'packages/utils/dist/index.js': '',
      'packages/utils/dist/sub.js': '',
      'packages/next/package.json': JSON.stringify({
        name: '@proj/next',
        exports: {
          '.': { flipped: './src/flipped.js', default: './dist/index.js' },
        },
      }),
      'packages/next/src/flipped.js': '',
      'packages/next/dist/index.js': '',
      // The `source` target is missing on purpose.
      'packages/gone/package.json': JSON.stringify({
        name: '@proj/gone',
        exports: {
          '.': { source: './src/index.ts', default: './dist/index.js' },
        },
      }),
      'packages/gone/dist/index.js': "module.exports = 'dist';\n",
      'gone-entry.cjs': "module.exports = require('@proj/gone');\n",
    });
    linkWorkspacePackages(root, ['utils', 'next', 'gone']);
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  afterEach(() => vi.restoreAllMocks());

  function captureResolveHook() {
    const nodeModule = require('node:module') as typeof import('node:module');
    const deregister = vi.fn();
    let resolveHook: Function;
    const registerHooks = vi
      .spyOn(nodeModule, 'registerHooks')
      .mockImplementation(({ resolve }) => {
        resolveHook = resolve;
        return { deregister } as any;
      });
    return {
      resolve: (specifier: string, context: unknown, nextResolve: Function) =>
        resolveHook(specifier, context, nextResolve),
      deregister,
      registerHooks,
    };
  }

  const context = (
    parentURL: string,
    conditions: Iterable<string> = ['node', 'import']
  ) => ({ conditions, importAttributes: {}, parentURL });

  it('resolves workspace package imports from a graph member through the exports map', () => {
    const hooks = captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);

    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/utils',
    ]);
    const nextResolve = vi.fn((specifier: string) => ({
      url: fileUrl('dist-resolved.js'),
    }));

    expect(
      hooks.resolve('@proj/utils', context(fileUrl('plugin.ts')), nextResolve)
    ).toEqual({
      url: fileUrl('packages/utils/src/index.ts'),
      shortCircuit: true,
    });
    expect(
      hooks.resolve(
        '@proj/utils/sub',
        context(fileUrl('plugin.ts')),
        nextResolve
      )
    ).toEqual({
      url: fileUrl('packages/utils/src/sub.ts'),
      shortCircuit: true,
    });
    expect(nextResolve).not.toHaveBeenCalled();

    const outsideContext = context(fileUrl('built-generator.js'));
    hooks.resolve('@proj/utils', outsideContext, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith('@proj/utils', outsideContext);

    cleanup();
    expect(hooks.deregister).toHaveBeenCalled();
  });

  it('honors the require condition when resolving through the exports map', () => {
    const hooks = captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);

    const cleanup = registerSourceGraphResolver(
      join(root, 'plugin.cjs'),
      root,
      ['@proj/utils']
    );
    const nextResolve = vi.fn();

    // CJS resolve hooks may hand conditions over as a Set.
    expect(
      hooks.resolve(
        '@proj/utils',
        context(fileUrl('plugin.cjs'), new Set(['require', 'node'])),
        nextResolve
      )
    ).toEqual({
      url: fileUrl('packages/utils/src/index.cts'),
      shortCircuit: true,
    });
    expect(
      hooks.resolve(
        '@proj/utils',
        context(fileUrl('plugin.cjs'), ['import', 'node']),
        nextResolve
      )
    ).toEqual({
      url: fileUrl('packages/utils/src/index.ts'),
      shortCircuit: true,
    });
    expect(nextResolve).not.toHaveBeenCalled();

    cleanup();
  });

  it('falls back to the default resolution with untouched conditions when the exports map cannot resolve', () => {
    const hooks = captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);

    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/unlinked',
    ]);
    const memberContext = context(fileUrl('plugin.ts'), ['node']);
    const nextResolve = vi.fn(() => ({ url: fileUrl('dist-resolved.js') }));

    const result = hooks.resolve('@proj/unlinked', memberContext, nextResolve);

    expect(result).toEqual({ url: fileUrl('dist-resolved.js') });
    expect(nextResolve).toHaveBeenCalledTimes(1);
    expect(nextResolve.mock.calls[0][1]).toBe(memberContext);

    cleanup();
  });

  // TypeScript moves on to the next matching condition when a target does not
  // resolve, so a graph member falls through to the default resolution where
  // Node's own `--conditions` would fail with a missing file.
  it('falls through to the default resolution when the selected source target is missing (ESM)', () => {
    const hooks = captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);

    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/gone',
    ]);
    const memberContext = context(fileUrl('plugin.ts'));
    const nextResolve = vi.fn(() => ({
      url: fileUrl('packages/gone/dist/index.js'),
    }));

    expect(hooks.resolve('@proj/gone', memberContext, nextResolve)).toEqual({
      url: fileUrl('packages/gone/dist/index.js'),
    });
    expect(nextResolve).toHaveBeenCalledWith('@proj/gone', memberContext);

    cleanup();
  });

  it('falls through to the default resolution when the selected source target is missing (CJS)', () => {
    captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);

    const entry = join(root, 'gone-entry.cjs');
    const cleanup = registerSourceGraphResolver(entry, root, ['@proj/gone']);

    expect(createRequire(import.meta.url)(entry)).toBe('dist');

    cleanup();
  });

  it('tracks relative source imports so lazy graph members resolve workspace packages', () => {
    const hooks = captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);

    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/utils',
    ]);
    const nextResolve = vi.fn(() => ({ url: fileUrl('lazy.ts') }));

    hooks.resolve('./lazy.js', context(fileUrl('plugin.ts')), nextResolve);
    expect(nextResolve).toHaveBeenCalledTimes(1);

    expect(
      hooks.resolve('@proj/utils', context(fileUrl('lazy.ts')), nextResolve)
    ).toEqual({
      url: fileUrl('packages/utils/src/index.ts'),
      shortCircuit: true,
    });
    expect(nextResolve).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('refreshes conditions and package names for a cached source graph', () => {
    const hooks = captureResolveHook();
    const conditions = vi
      .spyOn(typescriptUtils, 'getRootTsConfigResolveExportsConditions')
      .mockReturnValue(['source']);

    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/utils',
    ]);
    conditions.mockReturnValue(['flipped']);
    refreshSourceGraphResolvers(root, () => ['@proj/next']);

    const nextResolve = vi.fn(() => ({ url: fileUrl('dist-resolved.js') }));
    expect(
      hooks.resolve('@proj/next', context(fileUrl('plugin.ts')), nextResolve)
    ).toEqual({
      url: fileUrl('packages/next/src/flipped.js'),
      shortCircuit: true,
    });
    hooks.resolve('@proj/utils', context(fileUrl('plugin.ts')), nextResolve);
    expect(nextResolve).toHaveBeenCalledTimes(1);
    expect(nextResolve).toHaveBeenCalledWith(
      '@proj/utils',
      expect.objectContaining({ conditions: ['node', 'import'] })
    );

    cleanup();
  });

  it('reference counts registrations of the same entry', () => {
    const hooks = captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);

    const cleanupFirst = registerSourceGraphResolver(
      join(root, 'plugin.ts'),
      root,
      ['@proj/utils']
    );
    const cleanupSecond = registerSourceGraphResolver(
      join(root, 'plugin.ts'),
      root,
      ['@proj/utils']
    );
    expect(hooks.registerHooks).toHaveBeenCalledTimes(1);

    const nextResolve = vi.fn(() => ({ url: fileUrl('dist-resolved.js') }));
    // Releasing one registration, even twice, keeps the shared graph alive.
    cleanupFirst();
    cleanupFirst();
    expect(hooks.deregister).not.toHaveBeenCalled();
    expect(
      hooks.resolve('@proj/utils', context(fileUrl('plugin.ts')), nextResolve)
    ).toEqual({
      url: fileUrl('packages/utils/src/index.ts'),
      shortCircuit: true,
    });
    expect(nextResolve).not.toHaveBeenCalled();

    cleanupSecond();
    expect(hooks.deregister).toHaveBeenCalled();
    const memberContext = context(fileUrl('plugin.ts'));
    hooks.resolve('@proj/utils', memberContext, nextResolve);
    expect(nextResolve).toHaveBeenCalledWith('@proj/utils', memberContext);
  });

  it('skips the package-names thunk when no source graphs exist', () => {
    const getWorkspacePackageNames = vi.fn(() => ['@proj/utils']);

    refreshSourceGraphResolvers('/workspace', getWorkspacePackageNames);

    expect(getWorkspacePackageNames).not.toHaveBeenCalled();
  });

  it('identity-restores Module._load on the last cleanup when nothing else patched it', () => {
    captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);
    const nodeModule = require('node:module') as any;
    const originalLoad = nodeModule._load;

    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/utils',
    ]);
    expect(nodeModule._load).not.toBe(originalLoad);

    cleanup();
    expect(nodeModule._load).toBe(originalLoad);
  });

  it('leaves a later Module._load patch in place and neutralizes its own', () => {
    captureResolveHook();
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);
    const nodeModule = require('node:module') as any;
    const originalLoad = nodeModule._load;

    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/utils',
    ]);
    const ourPatched = nodeModule._load;
    const wrapper = function (this: unknown, ...args: unknown[]) {
      return ourPatched.apply(this, args);
    };
    nodeModule._load = wrapper;
    try {
      cleanup();
      expect(nodeModule._load).toBe(wrapper);
      // The neutralized patch still passes loads through.
      expect(nodeModule._load('node:path', undefined, false)).toBe(
        require('node:path')
      );
    } finally {
      nodeModule._load = originalLoad;
    }
  });
});

// Real require() calls cover the CJS caches that mocked nextResolve calls
// bypass.
describe('registerSourceGraphResolver CJS path cache isolation', () => {
  const registerHooksAvailable =
    typeof (require('node:module') as { registerHooks?: unknown })
      .registerHooks === 'function';

  let tempFs: InstanceType<typeof TempFs>;
  let workspaceDir: string;
  let runScript: string;

  beforeAll(() => {
    const req = createRequire(import.meta.url);
    const swcRegisterPath = req.resolve('@swc-node/register/register');
    const registerTsPath = fileURLToPath(
      new URL('./register.ts', import.meta.url)
    );

    tempFs = new TempFs('source-graph-cjs-cache', false);
    workspaceDir = join(tempFs.tempDir, 'workspace');
    const aliasDir = join(tempFs.tempDir, 'alias');
    runScript = join(tempFs.tempDir, 'run.cjs');

    tempFs.createFilesSync({
      // The relative hop verifies lazy graph-member tracking.
      'workspace/graph-entry.cjs':
        "module.exports = { ...require('./inner.cjs'), nested: require('./nested/member.cjs') };\n",
      'workspace/inner.cjs':
        "module.exports = { value: require('@proj/pkg'), resolved: require.resolve('@proj/pkg') };\n",
      // The nearer same-named external package must retain Node's resolution.
      'workspace/nested/member.cjs': "module.exports = require('@proj/pkg');\n",
      'workspace/nested/node_modules/@proj/pkg/package.json': JSON.stringify({
        name: '@proj/pkg',
        exports: {
          '.': {
            development: './src/index.js',
            default: './dist/index.js',
          },
        },
      }),
      'workspace/nested/node_modules/@proj/pkg/src/index.js':
        "module.exports = 'ext-source';\n",
      'workspace/nested/node_modules/@proj/pkg/dist/index.js':
        "module.exports = 'ext-dist';\n",
      'workspace/sibling.cjs': "module.exports = require('@proj/pkg');\n",
      'workspace/packages/pkg/package.json': JSON.stringify({
        name: '@proj/pkg',
        exports: {
          '.': {
            development: './src/index.js',
            default: './dist/index.js',
          },
        },
      }),
      'workspace/packages/pkg/src/index.js': "module.exports = 'source';\n",
      'workspace/packages/pkg/dist/index.js': "module.exports = 'dist';\n",
      'run.cjs': [
        `require(${JSON.stringify(swcRegisterPath)}).register({ esModuleInterop: true });`,
        `if (process.argv[3] === 'no-hooks') {`,
        `  require('node:module').registerHooks = undefined;`,
        `}`,
        `const { registerSourceGraphResolver } = require(${JSON.stringify(registerTsPath)});`,
        `const base = process.argv[4] === 'alias-root' ? ${JSON.stringify(aliasDir)} : ${JSON.stringify(workspaceDir)};`,
        `const entry = base + '/graph-entry.cjs';`,
        `const sibling = base + '/sibling.cjs';`,
        // Register the real path first to cover alias registration after an
        // existing graph.
        `const cleanupReal = process.argv[4] === 'alias-root' ? registerSourceGraphResolver(${JSON.stringify(join(workspaceDir, 'graph-entry.cjs'))}, ${JSON.stringify(workspaceDir)}, ['@proj/pkg']) : () => {};`,
        `const cleanup = registerSourceGraphResolver(entry, base, ['@proj/pkg']);`,
        `const results = {};`,
        `if (process.argv[2] === 'sibling-first') {`,
        `  results.sibling = require(sibling);`,
        `  results.entry = require(entry);`,
        `} else {`,
        `  results.entry = require(entry);`,
        `  results.sibling = require(sibling);`,
        `}`,
        `cleanupReal();`,
        `cleanup();`,
        `delete require.cache[sibling];`,
        `results.siblingAfterCleanup = require(sibling);`,
        `console.log(JSON.stringify(results));`,
      ].join('\n'),
    });
    linkWorkspacePackages(workspaceDir, ['pkg']);
    symlinkSync(workspaceDir, aliasDir, 'dir');
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  function runOrdering(
    order: 'graph-first' | 'sibling-first',
    hooks: 'hooks' | 'no-hooks' = 'hooks',
    root: 'real-root' | 'alias-root' = 'real-root',
    execArgv: string[] = []
  ) {
    const stdout = execFileSync(
      process.execPath,
      [...execArgv, runScript, order, hooks, root],
      {
        cwd: workspaceDir,
        env: { ...process.env, NX_WORKSPACE_ROOT_PATH: workspaceDir },
        encoding: 'utf8',
      }
    );
    return JSON.parse(stdout.trim().split('\n').pop()!);
  }

  const expectScoped = () => ({
    entry: {
      value: 'source',
      resolved: realpathSync(
        join(workspaceDir, 'node_modules/@proj/pkg/src/index.js')
      ),
      nested: 'ext-dist',
    },
    sibling: 'dist',
    siblingAfterCleanup: 'dist',
  });

  it.runIf(registerHooksAvailable)(
    'keeps the source export scoped to the graph entry when it resolves first',
    () => {
      expect(runOrdering('graph-first')).toEqual(expectScoped());
    },
    120_000
  );

  it.runIf(registerHooksAvailable)(
    'still applies the source export to the graph entry when the sibling resolves first',
    () => {
      expect(runOrdering('sibling-first')).toEqual(expectScoped());
    },
    120_000
  );

  it.each(['graph-first', 'sibling-first'] as const)(
    'scopes the source export without module.registerHooks (%s)',
    (order) => {
      expect(runOrdering(order, 'no-hooks')).toEqual(expectScoped());
    },
    120_000
  );

  it.each(['hooks', 'no-hooks'] as const)(
    'scopes the graph when the configured root is an alias of the real path (%s)',
    (hooks) => {
      expect(runOrdering('graph-first', hooks, 'alias-root')).toEqual(
        expectScoped()
      );
    },
    120_000
  );

  it.each(['hooks', 'no-hooks'] as const)(
    'scopes the graph under --preserve-symlinks with an alias root (%s)',
    (hooks) => {
      const results = runOrdering('graph-first', hooks, 'alias-root', [
        '--preserve-symlinks',
      ]);
      // Node keeps the alias spelling here, so only compare the markers.
      expect(results.entry.value).toBe('source');
      expect(results.entry.nested).toBe('ext-dist');
      expect(results.sibling).toBe('dist');
      expect(results.siblingAfterCleanup).toBe('dist');
    },
    120_000
  );
});

// Graph conditions must union with runtime conditions so all consumers select
// the same package instance.
describe('registerSourceGraphResolver CJS runtime condition union', () => {
  const registerHooksAvailable =
    typeof (require('node:module') as { registerHooks?: unknown })
      .registerHooks === 'function';

  let tempFs: InstanceType<typeof TempFs>;
  let workspaceDir: string;
  let runScript: string;

  beforeAll(() => {
    const req = createRequire(import.meta.url);
    const swcRegisterPath = req.resolve('@swc-node/register/register');
    const registerTsPath = fileURLToPath(
      new URL('./register.ts', import.meta.url)
    );

    tempFs = new TempFs('source-graph-cjs-conditions', false);
    workspaceDir = join(tempFs.tempDir, 'workspace');
    runScript = join(tempFs.tempDir, 'run.cjs');
    const graphEntry = join(workspaceDir, 'graph-entry.cjs');
    const sibling = join(workspaceDir, 'sibling.cjs');

    tempFs.createFilesSync({
      'workspace/graph-entry.cjs':
        "module.exports = { user: require('@proj/user-pkg'), dual: require('@proj/dual') };\n",
      'workspace/sibling.cjs':
        "module.exports = { user: require('@proj/user-pkg'), dual: require('@proj/dual') };\n",
      'workspace/packages/user-pkg/package.json': JSON.stringify({
        name: '@proj/user-pkg',
        exports: {
          '.': {
            userA: './user/index.js',
            development: './src/index.js',
            default: './dist/index.js',
          },
        },
      }),
      'workspace/packages/user-pkg/user/index.js': "module.exports = 'user';\n",
      'workspace/packages/user-pkg/src/index.js':
        "module.exports = 'source';\n",
      'workspace/packages/user-pkg/dist/index.js': "module.exports = 'dist';\n",
      'workspace/packages/dual/package.json': JSON.stringify({
        name: '@proj/dual',
        exports: {
          '.': {
            'module-sync': './esm/index.js',
            require: './cjs/index.js',
            default: './esm/index.js',
          },
        },
      }),
      'workspace/packages/dual/esm/index.js': "module.exports = 'esm';\n",
      'workspace/packages/dual/cjs/index.js': "module.exports = 'cjs';\n",
      'run.cjs': [
        `require(${JSON.stringify(swcRegisterPath)}).register({ esModuleInterop: true });`,
        `const { registerSourceGraphResolver } = require(${JSON.stringify(registerTsPath)});`,
        `const entry = ${JSON.stringify(graphEntry)};`,
        `const sibling = ${JSON.stringify(sibling)};`,
        `const cleanup = registerSourceGraphResolver(entry, ${JSON.stringify(workspaceDir)}, ['@proj/user-pkg', '@proj/dual']);`,
        `const results = { entry: require(entry), sibling: require(sibling) };`,
        `cleanup();`,
        `console.log(JSON.stringify(results));`,
      ].join('\n'),
    });
    linkWorkspacePackages(workspaceDir, ['user-pkg', 'dual']);
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  it.runIf(registerHooksAvailable)(
    'applies user --conditions and module-sync to graph members like any other consumer',
    () => {
      const stdout = execFileSync(
        process.execPath,
        ['--conditions=userA', runScript],
        {
          cwd: workspaceDir,
          env: { ...process.env, NX_WORKSPACE_ROOT_PATH: workspaceDir },
          encoding: 'utf8',
        }
      );
      const results = JSON.parse(stdout.trim().split('\n').pop()!);
      expect(results.sibling).toEqual({ user: 'user', dual: 'esm' });
      expect(results.entry.user).toBe('user');
      expect(results.entry.dual).toBe(results.sibling.dual);
    },
    120_000
  );
});

describe('registerSourceGraphResolver under Yarn PnP', () => {
  let tempFs: InstanceType<typeof TempFs>;
  let root: string;
  let nodeModule: typeof import('node:module') & {
    findPnpApi?: (path: string) => unknown;
  };
  const fileUrl = (relativePath: string) =>
    pathToFileURL(join(root, relativePath)).href;
  const context = (parentURL: string) => ({
    conditions: ['node', 'import'],
    importAttributes: {},
    parentURL,
  });

  beforeAll(() => {
    tempFs = new TempFs('source-graph-pnp', false);
    root = tempFs.tempDir;
    const packageJson = JSON.stringify({
      name: '@proj/utils',
      exports: {
        '.': { source: './src/index.ts', default: './dist/index.js' },
      },
    });
    // No node_modules: PnP keeps workspace packages only in its own map.
    tempFs.createFilesSync({
      'packages/utils/package.json': packageJson,
      'packages/utils/src/index.ts': '',
      'packages/utils/dist/index.js': '',
      '.yarn/__virtual__/@proj-utils-virtual-1/1/packages/utils/package.json':
        packageJson,
      '.yarn/__virtual__/@proj-utils-virtual-1/1/packages/utils/src/index.ts':
        '',
      '.yarn/cache/utils.zip/node_modules/@proj/utils/package.json':
        packageJson,
      '.yarn/cache/utils.zip/node_modules/@proj/utils/src/index.ts': '',
    });
  });

  afterAll(() => {
    tempFs.cleanup();
  });

  beforeEach(() => {
    nodeModule = require('node:module');
    Object.defineProperty(process.versions, 'pnp', {
      value: '3',
      configurable: true,
      enumerable: true,
    });
    vi.spyOn(
      typescriptUtils,
      'getRootTsConfigResolveExportsConditions'
    ).mockReturnValue(['source']);
  });

  afterEach(() => {
    delete (process.versions as { pnp?: string }).pnp;
    delete nodeModule.findPnpApi;
    vi.restoreAllMocks();
  });

  function withPnpApi(resolveToUnqualified: (request: string) => string) {
    const api = { resolveToUnqualified: vi.fn(resolveToUnqualified) };
    nodeModule.findPnpApi = vi.fn(() => api);
    return api;
  }

  function resolveFromGraphEntry() {
    let resolveHook: Function;
    vi.spyOn(nodeModule, 'registerHooks').mockImplementation(({ resolve }) => {
      resolveHook = resolve;
      return { deregister: vi.fn() } as any;
    });
    const cleanup = registerSourceGraphResolver(join(root, 'plugin.ts'), root, [
      '@proj/utils',
    ]);
    const nextResolve = vi.fn(() => ({ url: fileUrl('dist-resolved.js') }));
    const result = resolveHook(
      '@proj/utils',
      context(fileUrl('plugin.ts')),
      nextResolve
    );
    cleanup();
    return { result, nextResolve };
  }

  it('locates workspace packages through the PnP API instead of node_modules', () => {
    const api = withPnpApi(() => join(root, 'packages/utils/package.json'));

    const { result } = resolveFromGraphEntry();

    expect(result).toEqual({
      url: fileUrl('packages/utils/src/index.ts'),
      shortCircuit: true,
    });
    expect(nodeModule.findPnpApi).toHaveBeenCalledWith(join(root, sep));
    expect(api.resolveToUnqualified).toHaveBeenCalledWith(
      '@proj/utils/package.json',
      join(root, sep),
      { considerBuiltins: false }
    );
  });

  it('accepts the virtual alias PnP creates for workspace packages with peer dependencies', () => {
    withPnpApi(() =>
      join(
        root,
        '.yarn/__virtual__/@proj-utils-virtual-1/1/packages/utils/package.json'
      )
    );

    const { result } = resolveFromGraphEntry();

    expect(result).toEqual({
      url: fileUrl(
        '.yarn/__virtual__/@proj-utils-virtual-1/1/packages/utils/src/index.ts'
      ),
      shortCircuit: true,
    });
  });

  it('keeps Node resolution for a same-named package served from the PnP cache', () => {
    withPnpApi(() =>
      join(root, '.yarn/cache/utils.zip/node_modules/@proj/utils/package.json')
    );

    const { result, nextResolve } = resolveFromGraphEntry();

    expect(nextResolve).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ url: fileUrl('dist-resolved.js') });
  });

  it('keeps Node resolution when PnP rejects the request as undeclared', () => {
    withPnpApi(() => {
      throw new Error('Your application tried to access @proj/utils');
    });

    const { result, nextResolve } = resolveFromGraphEntry();

    expect(nextResolve).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ url: fileUrl('dist-resolved.js') });
  });
});

describe('CJS resolution under Yarn PnP below 4.11', () => {
  const unsupported = (options = 'conditions') =>
    Object.assign(
      new Error(
        `Some options passed to require() aren't supported by PnP yet (${options})`
      ),
      { code: 'UNSUPPORTED' }
    );
  const pnpStyleResolve = () =>
    vi.fn(function (
      request: string,
      _parent: unknown,
      _isMain: unknown,
      options?: { conditions?: unknown; paths?: string[] }
    ) {
      if (options?.conditions) throw unsupported();
      return `resolved:${request}`;
    });

  it('retries without the conditions option when PnP rejects it', () => {
    const original = pnpStyleResolve();
    const parent = { filename: '/ws/a.js' };
    const options = { conditions: new Set(['node']), paths: ['/ws'] };

    expect(
      callResolveFilename(original as any, null, 'pkg', parent, [
        false,
        options,
      ])
    ).toBe('resolved:pkg');
    expect(original).toHaveBeenCalledTimes(2);
    expect(original).toHaveBeenLastCalledWith('pkg', parent, false, {
      paths: ['/ws'],
    });
  });

  it('rethrows an UNSUPPORTED error that is not about conditions', () => {
    const original = vi.fn(() => {
      throw unsupported();
    });

    expect(() =>
      callResolveFilename(original as any, null, 'pkg', undefined, [
        false,
        { paths: ['/ws'] },
      ])
    ).toThrow(/aren't supported/);
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('rethrows a PnP rejection that names another option as well', () => {
    const original = vi.fn(() => {
      throw unsupported('conditions, arbitrary');
    });

    expect(() =>
      callResolveFilename(original as any, null, 'pkg', undefined, [
        false,
        { conditions: new Set(), arbitrary: true },
      ])
    ).toThrow(/\(conditions, arbitrary\)/);
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('rethrows a non-PnP UNSUPPORTED error even with conditions present', () => {
    const original = vi.fn(() => {
      throw Object.assign(new Error('something else'), { code: 'UNSUPPORTED' });
    });

    expect(() =>
      callResolveFilename(original as any, null, 'pkg', undefined, [
        false,
        { conditions: new Set() },
      ])
    ).toThrow('something else');
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('rethrows other resolution errors untouched', () => {
    const original = vi.fn(() => {
      throw Object.assign(new Error('nope'), { code: 'MODULE_NOT_FOUND' });
    });

    expect(() =>
      callResolveFilename(original as any, null, 'pkg', undefined, [
        false,
        { conditions: new Set() },
      ])
    ).toThrow('nope');
    expect(original).toHaveBeenCalledTimes(1);
  });

  it('applies the retry inside the source graph resolver patch', () => {
    const nodeModule = require('node:module') as any;
    const realResolveFilename = nodeModule._resolveFilename;
    const original = pnpStyleResolve();
    nodeModule._resolveFilename = original;
    vi.spyOn(nodeModule, 'registerHooks').mockImplementation(
      () => ({ deregister: vi.fn() }) as any
    );
    const cleanup = registerSourceGraphResolver('/ws/plugin.ts', '/ws', []);
    try {
      expect(
        nodeModule._resolveFilename('pkg', { filename: '/ws/a.js' }, false, {
          conditions: new Set(['node']),
        })
      ).toBe('resolved:pkg');
      expect(original).toHaveBeenCalledTimes(2);
    } finally {
      cleanup();
      nodeModule._resolveFilename = realResolveFilename;
      vi.restoreAllMocks();
    }
  });
});
