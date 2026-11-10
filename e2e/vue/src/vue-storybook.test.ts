import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

describe('Storybook generators and executors for Vue projects', () => {
  const vueStorybookApp = uniq('vue-app');
  let proj;

  beforeAll(async () => {
    proj = newProject({
      packages: ['@nx/vue', '@nx/vite', '@nx/storybook'],
    });
    runCLI(`generate @nx/vue:app ${vueStorybookApp} --no-interactive`);
    runCLI(
      `generate @nx/vue:storybook-configuration ${vueStorybookApp} --generateStories --no-interactive`
    );
  });

  afterAll(() => {
    cleanupProject();
  });

  describe('build storybook', () => {
    it('should build a vue based storybook setup', () => {
      runCLI(`run ${vueStorybookApp}:build-storybook --verbose`);
      checkFilesExist(`${vueStorybookApp}/storybook-static/index.html`);
    }, 300_000);
  });
});
