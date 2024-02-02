import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  newProject,
  runCLI,
  runCommand,
  uniq,
} from '@nx/e2e/utils';

const pmc = getPackageManagerCommand({
  packageManager: getSelectedPackageManager(),
});
// TODO(crystal, @mandarini): Investigate why this test is failing
xdescribe('Next.js Storybook', () => {
  let proj: string;

  beforeAll(
    () =>
      (proj = newProject({
        name: 'proj',
        packageManager: 'npm',
        packages: ['@nx/next', '@nx/react'],
      }))
  );

  afterAll(() => cleanupProject());

  it('should run a Next.js based Storybook setup', async () => {
    const appName = uniq('app');

    runCLI(`generate @nx/next:app ${appName} --no-interactive`);
    runCLI(
      `generate @nx/next:component Foo --project=${appName} --no-interactive`
    );

    runCLI(
      `generate @nx/react:storybook-configuration ${appName} --generateStories --no-interactive`
    );

    // It seems that we need to run install twice for some reason.
    // This is only true on CI. On normal repos, it works as expected.
    runCommand(pmc.install);

    runCLI(`build-storybook ${appName}`);
    checkFilesExist(`${appName}/storybook-static/index.html`);
  }, 600_000);
});
