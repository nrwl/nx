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
      packages: ['@nx/js'],
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

  it('should be able to release publishable js library', async () => {
    const jsLib = uniq('js-lib');
    runCLI(
      `generate @nx/js:lib ${jsLib} --publishable --importPath=@proj/${jsLib}`
    );

    let versionOutput = runCLI(`release --first-release`);
    versionOutput = runCLI(`release patch`);
    expect(versionOutput).toContain('Executing pre-version command');
  });
});
