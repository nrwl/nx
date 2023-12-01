import { loadEsmModule } from './module-loader';

export function ngCompilerCli(): Promise<
  typeof import('@angular/compiler-cli')
> {
  return loadEsmModule('@angular/compiler-cli');
}
