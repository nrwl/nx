import type * as ts from 'typescript';

/**
 * Minimal shape of `@angular/compiler-cli` that we consume. Hand-declared
 * because the package ships `"type": "module"` typings whose extensionless
 * `export *` re-exports don't resolve under `nodenext`, so `readConfiguration`
 * is not visible via `typeof import('@angular/compiler-cli')`.
 */
interface AngularCompilerCli {
  readConfiguration(
    project: string,
    existingOptions?: ts.CompilerOptions
  ): { options: ts.CompilerOptions; rootNames: readonly string[] };
}

let load;
export function loadCompilerCli(): Promise<AngularCompilerCli> {
  load ??= new Function('', `return import('@angular/compiler-cli');`);
  return load().catch((e) => {
    throw new Error(
      `Failed to load Angular Compiler CLI: ${e.message ?? e.toString()}`
    );
  });
}
