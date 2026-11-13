import { mkdtempSync, writeFileSync } from 'node:fs';
import Module from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MISSING_TYPESCRIPT_MESSAGE } from './optional-typescript';

/**
 * Makes `typescript` unresolvable to node, which is what a strict package
 * manager leaves the plugin with when the optional peer is absent.
 */
function hideTypescript(): () => void {
  const moduleInternals = Module as any;
  const originalResolveFilename = moduleInternals._resolveFilename;
  moduleInternals._resolveFilename = function (
    request: string,
    ...rest: any[]
  ) {
    if (request === 'typescript' || request.startsWith('typescript/')) {
      const error: NodeJS.ErrnoException = new Error(
        `Cannot find module 'typescript'`
      );
      error.code = 'MODULE_NOT_FOUND';
      throw error;
    }
    return originalResolveFilename.call(this, request, ...rest);
  };
  return () => {
    moduleInternals._resolveFilename = originalResolveFilename;
  };
}

describe('optional typescript', () => {
  afterEach(() => {
    vi.resetModules();
  });

  /**
   * Declared first because the later cases load the packages that read
   * `typescript`, after which node serves them from its module cache without
   * resolving `typescript` again, hiding an eager require. It uses `require`
   * rather than `import` so the modules resolve through node, the way the
   * published CommonJS build does, instead of through vite.
   */
  it('should let the plugin load without typescript and report it on use', () => {
    const sourceFile = join(
      mkdtempSync(join(tmpdir(), 'nx-eslint-plugin-')),
      'index.ts'
    );
    writeFileSync(sourceFile, 'export class MyClass {}');
    const restoreTypescript = hideTypescript();

    try {
      expect(Object.keys(require('../index').rules)).toContain(
        'enforce-module-boundaries'
      );

      const { getRelativeImportPath } = require('./ast-utils');
      expect(() => getRelativeImportPath('MyClass', sourceFile)).toThrow(
        MISSING_TYPESCRIPT_MESSAGE
      );
    } finally {
      restoreTypescript();
    }
  });

  it('should name the missing package instead of failing to resolve a module', async () => {
    const { loadGetModifiers, loadTsQuery, loadTypescript } =
      await import('./optional-typescript');
    const restoreTypescript = hideTypescript();

    try {
      expect(() => loadTypescript()).toThrow(MISSING_TYPESCRIPT_MESSAGE);
      expect(() => loadGetModifiers()).toThrow(MISSING_TYPESCRIPT_MESSAGE);
      expect(() => loadTsQuery()).toThrow(MISSING_TYPESCRIPT_MESSAGE);
    } finally {
      restoreTypescript();
    }
  });

  it('should load typescript and the packages that read it at load time', async () => {
    const { loadGetModifiers, loadTsQuery, loadTypescript } =
      await import('./optional-typescript');

    expect(typeof loadTypescript().createSourceFile).toBe('function');
    expect(typeof loadGetModifiers()).toBe('function');
    expect(typeof loadTsQuery()).toBe('function');
  });
});
