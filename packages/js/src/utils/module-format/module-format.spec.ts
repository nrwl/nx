import * as ts from 'typescript';
import {
  getPackageJsonModuleFormat,
  getTsConfigModuleFormat,
} from './module-format';

describe('getPackageJsonModuleFormat', () => {
  it('maps `type: "module"` to esm', () => {
    expect(getPackageJsonModuleFormat({ type: 'module' })).toBe('esm');
  });

  it('maps `type: "commonjs"` to cjs', () => {
    expect(getPackageJsonModuleFormat({ type: 'commonjs' })).toBe('cjs');
  });

  it('returns null for missing type field so callers can fall back', () => {
    expect(getPackageJsonModuleFormat({})).toBeNull();
  });

  it('returns null for unrecognized type values', () => {
    expect(getPackageJsonModuleFormat({ type: 'something-else' })).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(getPackageJsonModuleFormat(null)).toBeNull();
    expect(getPackageJsonModuleFormat(undefined)).toBeNull();
  });
});

describe('getTsConfigModuleFormat', () => {
  it('maps ES2015/ES2020/ES2022/ESNext to esm', () => {
    expect(getTsConfigModuleFormat({ module: ts.ModuleKind.ES2015 })).toBe(
      'esm'
    );
    expect(getTsConfigModuleFormat({ module: ts.ModuleKind.ES2020 })).toBe(
      'esm'
    );
    expect(getTsConfigModuleFormat({ module: ts.ModuleKind.ES2022 })).toBe(
      'esm'
    );
    expect(getTsConfigModuleFormat({ module: ts.ModuleKind.ESNext })).toBe(
      'esm'
    );
  });

  it('maps CommonJS to cjs', () => {
    expect(getTsConfigModuleFormat({ module: ts.ModuleKind.CommonJS })).toBe(
      'cjs'
    );
  });

  it('returns null for NodeNext / Node16 (defer to package.json)', () => {
    expect(
      getTsConfigModuleFormat({ module: ts.ModuleKind.NodeNext })
    ).toBeNull();
    expect(
      getTsConfigModuleFormat({ module: ts.ModuleKind.Node16 })
    ).toBeNull();
  });

  it('returns null for missing module setting', () => {
    expect(getTsConfigModuleFormat({})).toBeNull();
    expect(getTsConfigModuleFormat(null)).toBeNull();
    expect(getTsConfigModuleFormat(undefined)).toBeNull();
  });
});
