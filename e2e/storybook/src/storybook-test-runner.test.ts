import {
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  readJson,
  runCLI,
  runCommand,
  uniq,
} from '@nx/e2e-utils';

describe('Storybook story testing runner', () => {
  const viteApp = uniq('react-vite-app');

  beforeAll(() => {
    newProject({ packages: ['@nx/react', '@nx/storybook'] });
    runCLI(
      `generate @nx/react:app ${viteApp} --bundler=vite --unitTestRunner=none --no-interactive`,
      { timeout: 900_000 }
    );
    runCLI(
      `generate @nx/react:storybook-configuration ${viteApp} --generateStories --no-interactive`,
      { timeout: 900_000 }
    );
    // The generator adds the runner to package.json; inference needs it resolvable.
    runCommand(getPackageManagerCommand().install, { failOnError: true });
  }, 1_200_000);

  afterAll(() => {
    cleanupProject();
  });

  it('should install the test runner and infer a target that invokes it', () => {
    expect(
      readJson('package.json').devDependencies['@storybook/test-runner']
    ).toBeDefined();

    const project = JSON.parse(runCLI(`show project ${viteApp} --json`));
    // Inferred `command` targets are normalized into `options.command`.
    expect(project.targets['test-storybook'].options.command).toContain(
      'test-storybook'
    );
  });
});
