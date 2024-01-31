import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  setMaxWorkers,
  uniq,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Storybook generators and executors for Vue projects', () => {
  const vueStorybookApp = uniq('vue-app');
  let proj;
  beforeAll(async () => {
    proj = newProject({
      packages: ['@nx/vue', '@nx/storybook'],
      unsetProjectNameAndRootFormat: false,
    });
    runCLI(
      `generate @nx/vue:app ${vueStorybookApp} --project-name-and-root-format=as-provided --no-interactive`
    );
    setMaxWorkers(join(vueStorybookApp, 'project.json'));
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
