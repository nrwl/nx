import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-conflicting-extended-diagnostics';

const extendedDiagnostics = {
  checks: {
    nullishCoalescingNotNullable: 'suppress',
    optionalChainNotNullable: 'suppress',
  },
};

describe('remove-conflicting-extended-diagnostics migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function writeTsconfig(path: string, json: unknown): void {
    tree.write(path, JSON.stringify(json, null, 2));
  }

  it('removes extendedDiagnostics when strictTemplates is false in the same file', async () => {
    writeTsconfig('apps/app1/tsconfig.app.json', {
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics, strictTemplates: false },
    });

    await migration(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.angularCompilerOptions.extendedDiagnostics).toBeUndefined();
    expect(json.angularCompilerOptions.strictTemplates).toBe(false);
  });

  it('keeps extendedDiagnostics when strictTemplates is true', async () => {
    writeTsconfig('apps/app1/tsconfig.app.json', {
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics, strictTemplates: true },
    });

    await migration(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.angularCompilerOptions.extendedDiagnostics).toEqual(
      extendedDiagnostics
    );
  });

  it('keeps extendedDiagnostics when strictTemplates is unset (only explicit false conflicts)', async () => {
    writeTsconfig('apps/app1/tsconfig.app.json', {
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics },
    });

    await migration(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.angularCompilerOptions.extendedDiagnostics).toEqual(
      extendedDiagnostics
    );
  });

  it('removes extendedDiagnostics when strictTemplates is false in an extended base', async () => {
    writeTsconfig('tsconfig.base.json', {
      compilerOptions: { strict: false },
      angularCompilerOptions: { strictTemplates: false },
    });
    writeTsconfig('apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics },
    });

    await migration(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.angularCompilerOptions.extendedDiagnostics).toBeUndefined();
  });

  it('keeps extendedDiagnostics when an extended base enables strictTemplates', async () => {
    writeTsconfig('tsconfig.base.json', {
      compilerOptions: { strict: true },
      angularCompilerOptions: { strictTemplates: true },
    });
    writeTsconfig('apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics },
    });

    await migration(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.angularCompilerOptions.extendedDiagnostics).toEqual(
      extendedDiagnostics
    );
  });

  it('prefers a local strictTemplates over an inherited one', async () => {
    // Base disables strict templates, but the app re-enables them locally, so
    // extendedDiagnostics is valid and must be kept.
    writeTsconfig('tsconfig.base.json', {
      compilerOptions: {},
      angularCompilerOptions: { strictTemplates: false },
    });
    writeTsconfig('apps/app1/tsconfig.app.json', {
      extends: '../../tsconfig.base.json',
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics, strictTemplates: true },
    });

    await migration(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.angularCompilerOptions.extendedDiagnostics).toEqual(
      extendedDiagnostics
    );
  });

  it('does not touch tsconfig files without extendedDiagnostics', async () => {
    writeTsconfig('apps/app1/tsconfig.app.json', {
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { strictTemplates: false },
    });

    await migration(tree);

    const json = readJson(tree, 'apps/app1/tsconfig.app.json');
    expect(json.angularCompilerOptions).toEqual({ strictTemplates: false });
  });

  it('only removes the conflicting blocks across multiple projects', async () => {
    writeTsconfig('apps/conflicting/tsconfig.app.json', {
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics, strictTemplates: false },
    });
    writeTsconfig('apps/strict/tsconfig.app.json', {
      compilerOptions: { outDir: 'out' },
      angularCompilerOptions: { extendedDiagnostics, strictTemplates: true },
    });

    await migration(tree);

    expect(
      readJson(tree, 'apps/conflicting/tsconfig.app.json')
        .angularCompilerOptions.extendedDiagnostics
    ).toBeUndefined();
    expect(
      readJson(tree, 'apps/strict/tsconfig.app.json').angularCompilerOptions
        .extendedDiagnostics
    ).toEqual(extendedDiagnostics);
  });
});
