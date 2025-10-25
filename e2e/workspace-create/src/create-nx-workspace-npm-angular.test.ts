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

  it('should add angular application', () => {
    const wsName = getWorkspaceName();
    packageInstall('@nx/angular', wsName);
    const appName = uniq('my-app');

    expect(() => {
      runCLI(`generate @nx/angular:app packages/${appName} --no-interactive`);
    }).not.toThrow();
    checkFilesExist('tsconfig.base.json');
  }, 1_000_000);

  it('should add angular library', () => {
    const wsName = getWorkspaceName();
    packageInstall('@nx/angular', wsName);
    const libName = uniq('lib');

    expect(() => {
      runCLI(`generate @nx/angular:lib packages/${libName} --no-interactive`);
    }).not.toThrow();
    checkFilesExist('tsconfig.base.json');
    const tsconfig = readJson(`tsconfig.base.json`);
    expect(tsconfig.compilerOptions.paths).toEqual({
      [`@${wsName}/${libName}`]: [`packages/${libName}/src/index.ts`],
    });
  }, 1_000_000);
});
