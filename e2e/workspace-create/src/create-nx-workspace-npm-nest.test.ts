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

  it('should add nest application', () => {
    const wsName = getWorkspaceName();
    packageInstall('@nx/nest', wsName);

    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/nest:app packages/${appName} --no-interactive`);
    }).not.toThrow();
    checkFilesExist('tsconfig.base.json');
  });

  it('should add nest library', () => {
    const wsName = getWorkspaceName();
    packageInstall('@nx/nest', wsName);

    const libName = uniq('lib');

    expect(() => {
      runCLI(`generate @nx/nest:lib packages/${libName} --no-interactive`);
    }).not.toThrow();
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
