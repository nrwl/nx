import { ExecutorContext } from '@nrwl/devkit';
import {
  compileTypeScript,
  TypeScriptCompilationOptions,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import { Compiler } from './schema';
import { compileSwc } from './swc/compile-swc';

export async function compile(
  compilerOptions: Compiler,
  context: ExecutorContext,
  tsCompilationOptions: TypeScriptCompilationOptions,
  postCompilationCallback: () => void | Promise<void>
) {
  if (compilerOptions === 'tsc') {
    const result = compileTypeScript(tsCompilationOptions);
    await postCompilationCallback();
    return result;
  }

  if (compilerOptions === 'swc') {
    return compileSwc(tsCompilationOptions, postCompilationCallback);
  }
}
