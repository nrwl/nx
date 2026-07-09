import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { applyEs2022TargetDefaults } from './typescript-compiler-options';

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
