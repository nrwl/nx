import { detectPackageManager, joinPathFragments } from '@nx/devkit';
import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  packageManagerLockFile,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
} from '@nx/e2e/utils';

describe('Next.js Lock File', () => {
  let proj: string;
  let originalEnv: string;
  let packageManager;

  beforeEach(() => {
    proj = newProject({
      packages: ['@nx/next'],
    });
    packageManager = detectPackageManager(tmpProjPath());
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    cleanupProject();
  });

  it('should build and install pruned lock file', () => {
    const appName = uniq('app');
    runCLI(`generate @nx/next:app ${appName} --no-interactive --style=css`);

    const result = runCLI(`build ${appName} --generateLockfile=true`);
    expect(result).not.toMatch(/Graph is not consistent/);
    checkFilesExist(
      `dist/apps/${appName}/${packageManagerLockFile[packageManager]}`
    );
    runCommand(`${getPackageManagerCommand().ciInstall}`, {
      cwd: joinPathFragments(tmpProjPath(), 'dist/apps', appName),
    });
  }, 1_000_000);
});
