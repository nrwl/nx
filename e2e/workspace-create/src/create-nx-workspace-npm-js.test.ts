import {
  checkFilesExist,
  packageInstall,
  readJson,
  runCLI,
  uniq,
} from '@nx/e2e-utils';
import {
  setupNpmWorkspaceTest,
  getWorkspaceName,
} from './create-nx-workspace-npm-setup';

describe('create-nx-workspace --preset=npm', () => {
  setupNpmWorkspaceTest();

  it('should add js library', () => {
    const wsName = getWorkspaceName();
    packageInstall('@nx/js', wsName);

    const libName = uniq('lib');

    expect(() =>
      runCLI(`generate @nx/js:library packages/${libName} --no-interactive`)
    ).not.toThrow();
    checkFilesExist('tsconfig.base.json', 'tsconfig.json');
    const tsconfigBase = readJson(`tsconfig.base.json`);
    expect(tsconfigBase.compilerOptions.paths).toBeUndefined();
    const tsconfig = readJson(`tsconfig.json`);
    expect(tsconfig.extends).toBe('./tsconfig.base.json');
    expect(tsconfig.references).toStrictEqual([
      { path: `./packages/${libName}` },
    ]);
  });
});
