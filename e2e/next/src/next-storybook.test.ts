import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateJson,
} from '@nx/e2e/utils';

describe('Next.js Applications', () => {
  let proj: string;

  beforeEach(() => {
    proj = newProject({
      name: 'proj',
      packageManager: 'npm',
    });
  });

  afterEach(() => cleanupProject());

  it('should run a Next.js based Storybook setup', async () => {
    const appName = uniq('app');

    runCLI(`generate @nx/next:app ${appName} --no-interactive`);
    runCLI(
      `generate @nx/next:component Foo --project=${appName} --no-interactive`
    );

    // Currently due to auto-installing peer deps in pnpm, the generator can fail while installing deps with unmet peet deps.
    runCLI(
      `generate @nx/react:storybook-configuration ${appName} --generateStories --no-interactive`,
      {
        silenceError: true,
      }
    );

    runCLI(`build-storybook ${appName}`);
    checkFilesExist(`dist/storybook/${appName}/index.html`);
  }, 1_000_000);
});
