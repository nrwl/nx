import * as ts from 'typescript';

/**
 * Raises `target` to ES2022, the syntax the bundling pipeline emits
 * regardless of the configured target, defaulting `useDefineForClassFields`
 * to `false` in that case to keep the assignment semantics a lower target
 * implied. Returns whether the options were adjusted so callers can surface
 * a setup warning.
 */
export function applyEs2022TargetDefaults(
  compilerOptions: ts.CompilerOptions
): boolean {
  if (
    compilerOptions.target === undefined ||
    compilerOptions.target < ts.ScriptTarget.ES2022
  ) {
    compilerOptions.target = ts.ScriptTarget.ES2022;
    compilerOptions.useDefineForClassFields ??= false;
    return true;
  }
  return false;
}
