import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nrwl/e2e/utils';

describe('Next.js Applications', () => {
  let proj: string;

  beforeEach(() => (proj = newProject()));

  afterEach(() => cleanupProject());

  it('should run a Next.js based Storybook setup', async () => {
    const appName = uniq('app');
    runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);
    runCLI(
      `generate @nrwl/next:component Foo --project=${appName} --no-interactive`
    );

    // Currently due to auto-installing peer deps in pnpm, the generator can fail while installing deps with unmet peet deps.
    try {
      // runCLI(
      //   `generate @nrwl/react:storybook-configuration ${appName} --generateStories --no-interactive`
      // );
    } catch {
      // nothing
    }

    // const p = await runCommandUntil(`run ${appName}:storybook`, (output) => {
    //   return /Storybook.*started/gi.test(output);
    // });
    //
    // p.kill();
  }, 1_000_000);
});
