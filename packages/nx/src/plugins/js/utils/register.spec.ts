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
} from './register';

// Avoid a real swc registration side effect when exercising getTranspiler.
jest.mock('@swc-node/register/register', () => ({
  register: () => () => {},
}));

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

  function loadIsNativeStripPreferred(): boolean {
    let result: boolean;
    jest.isolateModules(() => {
      result = require('./register').isNativeStripPreferred();
    });
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

  it('prefers native strip when the runtime supports it', () => {
    setNativeTypescriptSupport('strip');
    delete process.env.NX_PREFER_TS_NODE;
    delete process.env.NX_PREFER_NODE_STRIP_TYPES;
    expect(loadIsNativeStripPreferred()).toBe(true);
  });

  it('does not prefer native strip when the runtime lacks support', () => {
    setNativeTypescriptSupport(false);
    delete process.env.NX_PREFER_TS_NODE;
    delete process.env.NX_PREFER_NODE_STRIP_TYPES;
    expect(loadIsNativeStripPreferred()).toBe(false);
  });

  it('does not prefer native strip when NX_PREFER_NODE_STRIP_TYPES is false', () => {
    setNativeTypescriptSupport('strip');
    process.env.NX_PREFER_NODE_STRIP_TYPES = 'false';
    expect(loadIsNativeStripPreferred()).toBe(false);
  });

  it('does not prefer native strip when NX_PREFER_TS_NODE is true', () => {
    setNativeTypescriptSupport('strip');
    process.env.NX_PREFER_TS_NODE = 'true';
    delete process.env.NX_PREFER_NODE_STRIP_TYPES;
    expect(loadIsNativeStripPreferred()).toBe(false);
  });
});

describe('getTranspiler', () => {
  // TS6 requires the suppression flag to avoid hard-erroring on deprecated options.
  it('sets ignoreDeprecations to "6.0" on TypeScript >= 6', () => {
    jest.isolateModules(() => {
      jest.doMock('typescript', () => ({
        ...jest.requireActual('typescript'),
        versionMajorMinor: '6.0',
      }));
      const { getTranspiler: fresh } =
        require('./register') as typeof import('./register');
      const opts: CompilerOptions = {};
      fresh(opts);
      expect(opts.ignoreDeprecations).toEqual('6.0');
    });
    jest.unmock('typescript');
  });

  // TS5 rejects the '6.0' value (TS5103) so the option must stay absent.
  it('leaves ignoreDeprecations unset on TypeScript < 6', () => {
    jest.isolateModules(() => {
      jest.doMock('typescript', () => ({
        ...jest.requireActual('typescript'),
        versionMajorMinor: '5.9',
      }));
      const { getTranspiler: fresh } =
        require('./register') as typeof import('./register');
      const opts: CompilerOptions = {};
      fresh(opts);
      expect(opts.ignoreDeprecations).toBeUndefined();
    });
    jest.unmock('typescript');
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

  beforeAll(() => {
    // Exercise the exact shipped hook source. It's authored as an ESM module
    // (registered as a `data:` module at runtime), so evaluate it as CommonJS
    // here - Jest's VM can't honor a `data:` dynamic import without
    // --experimental-vm-modules.
    const cjs =
      NODENEXT_ESM_RESOLVER_SOURCE.replace(
        'export async function resolve',
        'async function resolve'
      ) + '\nmodule.exports = { resolve };';
    const mod: { exports: { resolve?: ResolveHook } } = { exports: {} };
    new Function('module', 'exports', cjs)(mod, mod.exports);
    resolve = mod.exports.resolve!;
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
