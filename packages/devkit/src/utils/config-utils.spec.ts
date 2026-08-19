import { join } from 'path';
import {
  clearConfigFromRequireCache,
  isTranspilerRecoverableError,
  unwrapCjsInterop,
} from './config-utils';

// Jest's require.cache is not the real module cache, so the tests drive the
// helper through its injectable cache with hand-built module graphs.
describe('clearConfigFromRequireCache', () => {
  let cache: NodeJS.Dict<NodeModule>;

  function fakeModule(id: string, parent?: NodeModule): NodeModule {
    const mod = {
      id,
      filename: id,
      exports: {},
      parent: parent ?? null,
      children: [],
    } as unknown as NodeModule;
    if (parent) {
      parent.children.push(mod);
    }
    return mod;
  }

  function register(mod: NodeModule): NodeModule {
    cache[mod.id] = mod;
    return mod;
  }

  beforeEach(() => {
    cache = {};
  });

  it('should delete the config module and its local dependency subtree, leaving unrelated modules untouched', () => {
    const config = register(fakeModule(join('/virtual', 'config.ts')));
    const helper = register(fakeModule(join('/virtual', 'helper.ts'), config));
    const transitive = register(
      fakeModule(join('/virtual', 'transitive.ts'), helper)
    );
    const unrelated = register(fakeModule(join('/virtual', 'unrelated.ts')));

    clearConfigFromRequireCache(config.id, cache);

    expect(cache[config.id]).toBeUndefined();
    expect(cache[helper.id]).toBeUndefined();
    expect(cache[transitive.id]).toBeUndefined();
    expect(cache[unrelated.id]).toBe(unrelated);
  });

  it('should not delete node_modules dependencies or their subtrees', () => {
    const config = register(fakeModule(join('/virtual', 'config.ts')));
    const dep = register(
      fakeModule(join('/virtual', 'node_modules', 'dep', 'index.js'), config)
    );
    const depChild = register(
      fakeModule(join('/virtual', 'node_modules', 'dep', 'child.js'), dep)
    );

    clearConfigFromRequireCache(config.id, cache);

    expect(cache[config.id]).toBeUndefined();
    expect(cache[dep.id]).toBe(dep);
    expect(cache[depChild.id]).toBe(depChild);
  });

  it('should invalidate a shared dependency through both a retained older instance and the cache-current instance', () => {
    // config A retains an older instance of the shared helper in its
    // children, while the cache holds a newer instance (loaded by config
    // B) with its own dependency subtree.
    const configA = register(fakeModule(join('/virtual', 'a', 'config.ts')));
    const helperOld = fakeModule(join('/virtual', 'shared.ts'), configA);
    const helperNew = register(fakeModule(join('/virtual', 'shared.ts')));
    const transitive = register(
      fakeModule(join('/virtual', 'shared-dep.ts'), helperNew)
    );

    clearConfigFromRequireCache(configA.id, cache);

    expect(helperOld.id).toBe(helperNew.id);
    expect(cache[helperNew.id]).toBeUndefined();
    expect(cache[transitive.id]).toBeUndefined();
  });

  it('should detach all instances of the config from the parent so repeated reloads do not accumulate them', () => {
    const parent = fakeModule(join('/virtual', 'loader.ts'));
    const configId = join('/virtual', 'config.ts');
    fakeModule(configId, parent);
    register(fakeModule(configId, parent));
    expect(parent.children).toHaveLength(2);

    clearConfigFromRequireCache(configId, cache);

    expect(parent.children).toHaveLength(0);
  });

  it('should terminate on dependency cycles', () => {
    const config = register(fakeModule(join('/virtual', 'config.ts')));
    const helper = register(fakeModule(join('/virtual', 'helper.ts'), config));
    helper.children.push(config);

    clearConfigFromRequireCache(config.id, cache);

    expect(cache[config.id]).toBeUndefined();
    expect(cache[helper.id]).toBeUndefined();
  });

  it('should be a no-op for a module that is not cached', () => {
    expect(() =>
      clearConfigFromRequireCache(join('/virtual', 'missing.ts'), cache)
    ).not.toThrow();
  });
});

describe('isTranspilerRecoverableError', () => {
  const tsPath = join('/virtual', 'config.ts');

  const cases: Array<[Error, string, boolean]> = [
    [
      new ReferenceError('__dirname is not defined in ES module scope'),
      tsPath,
      true,
    ],
    [new ReferenceError('require is not defined'), tsPath, true],
    [new ReferenceError('someGlobal is not defined'), tsPath, false],
    [
      new SyntaxError(
        "The requested module './types.ts' does not provide an export named 'Foo'"
      ),
      tsPath,
      true,
    ],
    [
      new ReferenceError('__dirname is not defined'),
      join('/virtual', 'config.js'),
      false,
    ],
  ];

  it('should classify recoverable errors with the host nx classifiers', () => {
    for (const [err, path, expected] of cases) {
      expect(isTranspilerRecoverableError(err, path)).toBe(expected);
    }
  });

  it('should classify identically on a host nx that does not export the classifiers', () => {
    // nx 23.0/23.1 recover these error classes in loadTsFile but do not
    // re-export the classifiers from devkit-internals.
    jest.isolateModules(() => {
      jest.doMock('nx/src/devkit-internals', () => ({}));
      const {
        isTranspilerRecoverableError: withoutHostClassifiers,
      } = require('./config-utils');
      for (const [err, path, expected] of cases) {
        expect(withoutHostClassifiers(err, path)).toBe(expected);
      }
    });
    jest.dontMock('nx/src/devkit-internals');
  });
});

describe('unwrapCjsInterop', () => {
  const path = join('/virtual', 'config.ts');

  function cjsShapedNamespace() {
    return {
      default: { __esModule: true, default: { value: 1 }, extra: 'kept' },
    };
  }

  it('should unwrap when require.cache proves the load went through the CJS pipeline', () => {
    const module = cjsShapedNamespace();
    const cache = {
      [path]: { exports: module.default } as unknown as NodeModule,
    };

    expect(unwrapCjsInterop(path, module, cache)).toBe(module.default);
  });

  it('should unwrap CJS exports that carry no __esModule marker', () => {
    // Some loaders (observed with @swc-node/register/esm) emit CJS exports
    // without the interop marker; the cache identity is the discriminator.
    const module = { default: { default: { value: 1 } } };
    const cache = {
      [path]: { exports: module.default } as unknown as NodeModule,
    };

    expect(unwrapCjsInterop(path, module, cache)).toBe(module.default);
  });

  it('should preserve a genuine ESM module with the same shape when require.cache has no entry', () => {
    const module = cjsShapedNamespace();

    expect(unwrapCjsInterop(path, module, {})).toBe(module);
  });

  it('should preserve the module when the cached exports are a different object', () => {
    const module = cjsShapedNamespace();
    const cache = {
      [path]: {
        exports: { ...module.default },
      } as unknown as NodeModule,
    };

    expect(unwrapCjsInterop(path, module, cache)).toBe(module);
  });

  it('should preserve a default-less ESM namespace instead of unwrapping to undefined', () => {
    const module = { named: { value: 1 } };

    expect(unwrapCjsInterop(path, module, {})).toBe(module);
  });
});
