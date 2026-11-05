import { existsSync, readFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import type { CompilerOptions } from 'typescript';
import {
  withTypescriptApi,
  type ApiCompilerOptions,
  type ApiTypescriptBackend,
} from './typescript-backend';

const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];
const NODE_MODULES_RE = /[\\/]node_modules[\\/]/;
// The same value in every TypeScript version Nx supports.
const MODULE_KIND_ESNEXT = 99;

type ExtensionHandler = (module: NodeModule, filename: string) => void;
type CompilableModule = NodeModule & {
  _compile(code: string, filename: string): unknown;
};

/**
 * Transpiles required TypeScript files outside node_modules with the
 * TypeScript 7.1 API, hooking `require` the way `@swc-node/register` does
 * through pirates.
 *
 * @returns cleanup that restores the previous extension handlers
 */
export function registerTypescriptApiRequireHook(
  backend: ApiTypescriptBackend,
  compilerOptions: CompilerOptions
): () => void {
  const extensionHandlers: Record<string, ExtensionHandler> = (
    require('node:module') as { _extensions: Record<string, ExtensionHandler> }
  )._extensions;

  const restores: Array<() => void> = [];
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    const previous = extensionHandlers[extension];
    const load = previous ?? extensionHandlers['.js'];
    const hook: ExtensionHandler = (module, filename) => {
      if (!NODE_MODULES_RE.test(filename)) {
        // Node strips types after `_compile` receives the file's source, so
        // the source swapped in here is the untouched TypeScript.
        const compilable = module as CompilableModule;
        const compile = compilable._compile;
        compilable._compile = (code: string) => {
          compilable._compile = compile;
          return compile.call(
            compilable,
            transpile(backend, code, filename, compilerOptions),
            filename
          );
        };
      }
      load(module, filename);
    };
    extensionHandlers[extension] = hook;
    restores.push(() => {
      if (extensionHandlers[extension] !== hook) {
        return;
      }
      if (previous) {
        extensionHandlers[extension] = previous;
      } else {
        delete extensionHandlers[extension];
      }
    });
  }

  return () => {
    for (const restore of restores) {
      restore();
    }
  };
}

/**
 * Registers an in-thread ESM load hook that transpiles imported TypeScript
 * modules outside node_modules with the TypeScript 7.1 API. CommonJS files
 * pass through to the require hook.
 *
 * @returns false when the runtime lacks `module.registerHooks` (Node.js < 22.15)
 */
export function registerTypescriptApiImportHook(
  backend: ApiTypescriptBackend,
  compilerOptions: CompilerOptions
): boolean {
  const module = require('node:module') as typeof import('node:module');
  if (typeof module.registerHooks !== 'function') {
    return false;
  }

  const esmCompilerOptions: CompilerOptions = {
    ...compilerOptions,
    module: MODULE_KIND_ESNEXT,
    moduleResolution: undefined,
  };
  module.registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('file:') || context.conditions?.includes('require')) {
        return nextLoad(url, context);
      }
      const filePath = fileURLToPath(url);
      if (
        NODE_MODULES_RE.test(filePath) ||
        !TYPESCRIPT_EXTENSIONS.includes(extname(filePath)) ||
        !isEsmFormat(filePath, context.format)
      ) {
        return nextLoad(url, context);
      }
      return {
        format: 'module',
        source: transpile(
          backend,
          readFileSync(filePath, 'utf-8'),
          filePath,
          esmCompilerOptions
        ),
        shortCircuit: true,
      };
    },
  });
  return true;
}

function transpile(
  backend: ApiTypescriptBackend,
  code: string,
  fileName: string,
  compilerOptions: CompilerOptions
): string {
  return withTypescriptApi(
    backend,
    (api) =>
      api.transpileModule(code, {
        fileName,
        compilerOptions: compilerOptions as unknown as ApiCompilerOptions,
      }).outputText
  );
}

// Node.js without TypeScript support reports no format for `.ts` files, so
// fall back to its own rules: the extension, then the package scope's `type`.
function isEsmFormat(filePath: string, format: string | null | undefined) {
  switch (format) {
    case 'module':
    case 'module-typescript':
      return true;
    case 'commonjs':
    case 'commonjs-typescript':
      return false;
  }
  switch (extname(filePath)) {
    case '.mts':
      return true;
    case '.cts':
      return false;
    default:
      return getPackageScopeType(dirname(filePath)) === 'module';
  }
}

const packageScopeTypeByDir = new Map<string, string | undefined>();

function getPackageScopeType(dir: string): string | undefined {
  if (packageScopeTypeByDir.has(dir)) {
    return packageScopeTypeByDir.get(dir);
  }
  let type: string | undefined;
  const packageJsonPath = join(dir, 'package.json');
  if (existsSync(packageJsonPath)) {
    type = JSON.parse(readFileSync(packageJsonPath, 'utf-8')).type;
  } else if (dirname(dir) !== dir && !dir.endsWith(`node_modules`)) {
    type = getPackageScopeType(dirname(dir));
  }
  packageScopeTypeByDir.set(dir, type);
  return type;
}
