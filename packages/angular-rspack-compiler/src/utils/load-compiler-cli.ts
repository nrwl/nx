let load;
export function loadCompilerCli(): Promise<
  typeof import('@angular/compiler-cli')
> {
  load ??= new Function('', `return import('@angular/compiler-cli');`);
  return load().catch((e) => {
    throw new Error(
      `Failed to load Angular Compiler CLI: ${e.message ?? e.toString()}`
    );
  });
}
