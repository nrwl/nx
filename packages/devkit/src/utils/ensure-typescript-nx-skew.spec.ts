import { rewriteDevkitDeepImports } from '../migrations/update-23-0-0/update-deep-imports';

// devkit's `nx` peer spans a major either side, and an nx without
// getTypescriptAst hands devkit `undefined` for it rather than a load failure.
vi.mock('nx/src/devkit-internals', async () => ({
  ...(await vi.importActual<any>('nx/src/devkit-internals')),
  getTypescriptAst: undefined,
}));

describe('ensureTypescript against an nx without getTypescriptAst', () => {
  it('loads the TypeScript module for devkit migrations', () => {
    expect(
      rewriteDevkitDeepImports(
        `import { names } from '@nx/devkit/src/utils/names';\n`
      )
    ).toBe(`import { names } from '@nx/devkit';\n`);
  });
});
