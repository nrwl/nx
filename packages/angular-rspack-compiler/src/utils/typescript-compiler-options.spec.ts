import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  applyEs2022TargetDefaults,
  resolveSwcTranspilationTransform,
} from './typescript-compiler-options';

// The tsconfig fixtures must live on the real filesystem: the package test
// setup mocks `fs` with memfs, but `ts.sys` reads configs outside the mock.
let realFs: typeof import('node:fs');
beforeAll(async () => {
  realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
});

describe('applyEs2022TargetDefaults', () => {
  it.each([
    [{}, ts.ScriptTarget.ES2022, false, true],
    [{ target: ts.ScriptTarget.ES2020 }, ts.ScriptTarget.ES2022, false, true],
    [
      { target: ts.ScriptTarget.ES2020, useDefineForClassFields: true },
      ts.ScriptTarget.ES2022,
      true,
      true,
    ],
    [
      { target: ts.ScriptTarget.ES2022 },
      ts.ScriptTarget.ES2022,
      undefined,
      false,
    ],
    [
      { target: ts.ScriptTarget.ESNext },
      ts.ScriptTarget.ESNext,
      undefined,
      false,
    ],
  ])(
    'should adjust %o only when the target is below ES2022',
    (compilerOptions: ts.CompilerOptions, target, udcf, adjusted) => {
      expect(applyEs2022TargetDefaults(compilerOptions)).toBe(adjusted);
      expect(compilerOptions.target).toBe(target);
      expect(compilerOptions.useDefineForClassFields).toBe(udcf);
    }
  );
});

describe('resolveSwcTranspilationTransform', () => {
  let dir: string;
  let jsxCaseId = 0;

  const writeTsConfig = (
    name: string,
    compilerOptions: Record<string, unknown>,
    extendsPath?: string
  ) => {
    const path = join(dir, name);
    realFs.writeFileSync(
      path,
      JSON.stringify({
        ...(extendsPath ? { extends: extendsPath } : {}),
        compilerOptions,
        files: [],
      })
    );
    return path;
  };

  beforeAll(() => {
    dir = realFs.mkdtempSync(join(tmpdir(), 'swc-transform-'));
  });

  afterAll(() => {
    realFs.rmSync(dir, { recursive: true, force: true });
  });

  it('should derive legacy decorator semantics for the default Angular tsconfig', () => {
    const path = writeTsConfig('ng-default.json', {
      experimentalDecorators: true,
      isolatedModules: true,
      target: 'ES2022',
    });

    expect(resolveSwcTranspilationTransform(path, '2023-11')).toEqual({
      legacyDecorator: true,
      decoratorMetadata: false,
      useDefineForClassFields: true,
      verbatimModuleSyntax: false,
      react: { runtime: 'classic', development: false },
    });
  });

  it('should use assignment class field semantics when the target is below ES2022', () => {
    const path = writeTsConfig('mf.json', {
      experimentalDecorators: true,
      target: 'ES2020',
    });

    expect(resolveSwcTranspilationTransform(path, '2023-11')).toMatchObject({
      useDefineForClassFields: false,
    });
  });

  it('should keep an explicit useDefineForClassFields', () => {
    const belowTarget = writeTsConfig('udcf-below.json', {
      target: 'ES2020',
      useDefineForClassFields: true,
    });
    const es2022 = writeTsConfig('udcf-es2022.json', {
      target: 'ES2022',
      useDefineForClassFields: false,
    });

    expect(
      resolveSwcTranspilationTransform(belowTarget, '2023-11')
    ).toMatchObject({
      useDefineForClassFields: true,
    });
    expect(resolveSwcTranspilationTransform(es2022, '2023-11')).toMatchObject({
      useDefineForClassFields: false,
    });
  });

  it('should select standard decorators with the given revision when experimentalDecorators is not set', () => {
    const path = writeTsConfig('tc39.json', { target: 'ES2022' });

    expect(resolveSwcTranspilationTransform(path, '2022-03')).toMatchObject({
      legacyDecorator: false,
      decoratorVersion: '2022-03',
    });
  });

  it('should emit decorator metadata only with legacy decorators', () => {
    const legacy = writeTsConfig('metadata-legacy.json', {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      target: 'ES2022',
    });
    const standard = writeTsConfig('metadata-standard.json', {
      emitDecoratorMetadata: true,
      target: 'ES2022',
    });

    expect(resolveSwcTranspilationTransform(legacy, '2023-11')).toMatchObject({
      decoratorMetadata: true,
    });
    expect(resolveSwcTranspilationTransform(standard, '2023-11')).toMatchObject(
      {
        decoratorMetadata: false,
      }
    );
  });

  it('should honor verbatimModuleSyntax', () => {
    const path = writeTsConfig('vms.json', {
      target: 'ES2022',
      verbatimModuleSyntax: true,
    });

    expect(resolveSwcTranspilationTransform(path, '2023-11')).toMatchObject({
      verbatimModuleSyntax: true,
    });
  });

  it.each([
    [{}, { runtime: 'classic', development: false }],
    [{ jsx: 'react' }, { runtime: 'classic', development: false }],
    [{ jsx: 'preserve' }, { runtime: 'classic', development: false }],
    [{ jsx: 'react-native' }, { runtime: 'classic', development: false }],
    [{ jsx: 'react-jsx' }, { runtime: 'automatic', development: false }],
    [{ jsx: 'react-jsxdev' }, { runtime: 'automatic', development: true }],
    [
      { jsx: 'react', jsxFactory: 'h', jsxFragmentFactory: 'F' },
      { runtime: 'classic', development: false, pragma: 'h', pragmaFrag: 'F' },
    ],
    [
      { jsx: 'react-jsx', jsxImportSource: 'preact' },
      { runtime: 'automatic', development: false, importSource: 'preact' },
    ],
  ])(
    'should derive the JSX transform from %o like esbuild',
    (jsxOptions, expected) => {
      const path = writeTsConfig(`jsx-${jsxCaseId++}.json`, {
        target: 'ES2022',
        ...jsxOptions,
      });

      expect(resolveSwcTranspilationTransform(path, '2023-11').react).toEqual(
        expected
      );
    }
  );

  it('should resolve options through an extends chain', () => {
    realFs.mkdirSync(join(dir, 'nested'), { recursive: true });
    realFs.writeFileSync(
      join(dir, 'nested', 'base.json'),
      JSON.stringify({
        compilerOptions: { experimentalDecorators: true, target: 'ES2020' },
      })
    );
    const path = writeTsConfig('child.json', {}, './nested/base.json');

    expect(resolveSwcTranspilationTransform(path, '2023-11')).toMatchObject({
      legacyDecorator: true,
      useDefineForClassFields: false,
    });
  });

  it('should derive the forced defaults when the tsconfig is missing or malformed', () => {
    const malformed = join(dir, 'malformed.json');
    realFs.writeFileSync(malformed, '{ not json');

    for (const path of [join(dir, 'missing.json'), malformed]) {
      expect(resolveSwcTranspilationTransform(path, '2023-11')).toEqual({
        legacyDecorator: false,
        decoratorVersion: '2023-11',
        decoratorMetadata: false,
        useDefineForClassFields: false,
        verbatimModuleSyntax: false,
        react: { runtime: 'classic', development: false },
      });
    }
  });
});
