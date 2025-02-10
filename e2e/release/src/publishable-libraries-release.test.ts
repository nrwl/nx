import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandAsync,
  uniq,
} from '@nx/e2e/utils';

describe('publishable libraries release', () => {
  beforeAll(async () => {
    newProject({
      packages: ['@nx/js', '@nx/react'],
    });
    // Normalize git committer information so it is deterministic in snapshots
    await runCommandAsync(`git config user.email "test@test.com"`);
    await runCommandAsync(`git config user.name "Test"`);
    // Create a baseline version tag
    await runCommandAsync(`git tag v0.0.0`);

    // We need a valid git origin to exist for the commit references to work (and later the test for createRelease)
    await runCommandAsync(
      `git remote add origin https://github.com/nrwl/fake-repo.git`
    );
  });
  afterAll(() => cleanupProject());

  it('should be able release js publishable libraries', async () => {
    const jsLib = uniq('js-lib');
    runCLI(
      `generate @nx/js:lib ${jsLib} --publishable --importPath=@proj/${jsLib}`
    );

    runCLI(`release --first-release`);
    const versionOutput = runCLI(`release patch`);
    expect(versionOutput).toContain('Executing pre-version command');
  });

  it('should be able release react publishable libraries', async () => {
    const reactLib = uniq('react-lib');
    runCLI(
      `generate @nx/react:lib ${reactLib} --publishable --importPath=@proj/${reactLib}`
    );
    const versionOutput = runCLI(`release patch`);
    expect(versionOutput).toContain('Executing pre-version command');
  });

  it('should be able release remix publishable libraries', async () => {
    const remixLib = uniq('remix-lib');
    runCLI(
      `generate @nx/react:lib ${remixLib} --publishable --importPath=@proj/${remixLib}`
    );
    const versionOutput = runCLI(`release patch`);
    expect(versionOutput).toContain('Executing pre-version command');
  });
});
