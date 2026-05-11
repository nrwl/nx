import { JsxEmit, ModuleKind, ScriptTarget } from 'typescript';
import {
  getTsNodeCompilerOptions,
  isCjsSyntaxError,
  isNativeTypeStripError,
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
