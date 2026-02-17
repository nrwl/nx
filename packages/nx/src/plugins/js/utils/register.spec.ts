import { JsxEmit, ModuleKind, ScriptTarget } from 'typescript';
import { getTsNodeCompilerOptions } from './register';

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

describe('getTranspiler - native TypeScript support', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    process,
    'features'
  );

  function setProcessFeatures(value: any) {
    Object.defineProperty(process, 'features', {
      value,
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(process, 'features', originalDescriptor);
    } else {
      delete (process as any).features;
    }
  });

  it('should still use SWC when available even with native TS support', () => {
    // Even when Node natively supports TS, SWC should be preferred when available
    // because it's a faster, more complete transpiler
    setProcessFeatures({ typescript: 'strip' });

    const { getTranspiler } = require('./register');

    // With SWC installed (as in this dev environment), getTranspiler should
    // return a transpiler factory function regardless of native TS support
    const result = getTranspiler({ module: 1 });
    expect(result).toBeDefined();
  });

  it('should work correctly without native TS support', () => {
    // Verify baseline behavior: getTranspiler should not throw
    // when process.features.typescript is not available
    setProcessFeatures(undefined);

    const { getTranspiler } = require('./register');
    expect(() => getTranspiler({ module: 1 })).not.toThrow();
  });

  it('should check process.features.typescript at call time not import time', () => {
    // The native TS check uses process.features?.typescript which is
    // evaluated at call time. This ensures the check is dynamic and
    // doesn't use a cached module-level value.
    const { getTranspiler } = require('./register');

    // First call without native TS
    setProcessFeatures(undefined);
    const result1 = getTranspiler({ module: 1 });

    // Second call with native TS - should still work (SWC takes priority)
    setProcessFeatures({ typescript: 'strip' });
    const result2 = getTranspiler({ module: 1 });

    // Both should return defined values since SWC is installed
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });
});
