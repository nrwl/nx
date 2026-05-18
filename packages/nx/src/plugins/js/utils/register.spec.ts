import { JsxEmit, ModuleKind, ScriptTarget } from 'typescript';
import {
  getTsNodeCompilerOptions,
  isCjsSyntaxError,
  isNativeTypeStripError,
  isRequireInEsmScopeError,
  isTsEsmNamedExportLinkageError,
  isTsEsmSyntaxError,
  registerTsExtensionsForResolution,
} from './register';

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

describe('registerTsExtensionsForResolution', () => {
  const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];

  /**
   * These tests pass a fake `extensionsRegistry` object so they are
   * decoupled from Jest's cross-module `require.extensions` isolation (each
   * Jest module gets its own `require` and therefore its own
   * `require.extensions` proxy, making it impossible to observe changes made
   * inside an imported function from the test's own `require.extensions`).
   */

  it('registers TypeScript extensions in the provided registry', () => {
    const registry: NodeJS.RequireExtensions = {} as any;
    const cleanup = registerTsExtensionsForResolution(registry);

    for (const ext of TS_EXTENSIONS) {
      expect(registry[ext]).toBeDefined();
    }

    cleanup();
  });

  it('cleanup removes the registered extensions from the registry', () => {
    const registry: NodeJS.RequireExtensions = {} as any;
    const cleanup = registerTsExtensionsForResolution(registry);
    cleanup();

    for (const ext of TS_EXTENSIONS) {
      expect(registry[ext]).toBeUndefined();
    }
  });

  it('is idempotent: does not override an already-registered extension', () => {
    const sentinel = jest.fn() as unknown as NodeJS.RequireExtensions[string];
    const registry: NodeJS.RequireExtensions = { '.ts': sentinel } as any;

    const cleanup = registerTsExtensionsForResolution(registry);

    // The pre-existing handler must not be overwritten
    expect(registry['.ts']).toBe(sentinel);

    cleanup();

    // The sentinel stays — it was not added by this call, so cleanup must not remove it
    expect(registry['.ts']).toBe(sentinel);
  });

  it('delegates to the registry .js handler when available (passthrough, not a new transpiler)', () => {
    const jsHandler = jest.fn() as unknown as NodeJS.RequireExtensions[string];
    const registry: NodeJS.RequireExtensions = { '.js': jsHandler } as any;

    const cleanup = registerTsExtensionsForResolution(registry);

    // Every TS extension should reuse the .js handler — no custom transpiler
    for (const ext of TS_EXTENSIONS) {
      expect(registry[ext]).toBe(jsHandler);
    }

    cleanup();
  });

  it('uses a no-op fallback handler when the .js handler is not registered', () => {
    // Simulate a Jest-like environment where require.extensions['.js'] is absent
    const registry: NodeJS.RequireExtensions = {} as any;

    const cleanup = registerTsExtensionsForResolution(registry);

    // All TS extensions must be a function so require.resolve can find them
    for (const ext of TS_EXTENSIONS) {
      expect(typeof registry[ext]).toBe('function');
    }

    cleanup();
  });

  it('all registered handlers are the same function (all extensions share one stub)', () => {
    const registry: NodeJS.RequireExtensions = {} as any;

    const cleanup = registerTsExtensionsForResolution(registry);

    // All four TS extensions must share the same handler reference (either
    // the .js passthrough or the fallback stub).
    const handler = registry['.ts'];
    expect(handler).toBeDefined();
    for (const ext of TS_EXTENSIONS) {
      expect(registry[ext]).toBe(handler);
    }

    cleanup();
  });
});
