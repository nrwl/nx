import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileFunction } from 'node:vm';
import { ModuleKind, transpileModule } from 'typescript';

describe('requireWithNativeJsLoader', () => {
  it('loads with the require Node gives modules loaded through its ESM loader', () => {
    const { outputText } = transpileModule(
      readFileSync(join(__dirname, 'native-js-loader.ts'), 'utf-8'),
      { compilerOptions: { module: ModuleKind.CommonJS } }
    );
    // Like Node's: `resolve` but no `extensions` or `cache`.
    const requiredPaths: string[] = [];
    const esmLoaderRequire = Object.assign(
      (path: string) => {
        requiredPaths.push(path);
        return { path };
      },
      { resolve: (path: string) => path }
    );
    const module = { exports: {} as typeof import('./native-js-loader') };

    compileFunction(outputText, ['exports', 'require', 'module'])(
      module.exports,
      esmLoaderRequire,
      module
    );

    expect(
      module.exports.requireWithNativeJsLoader('/workspace/process.js')
    ).toEqual({ path: '/workspace/process.js' });
    expect(requiredPaths).toEqual(['/workspace/process.js']);
  });
});
