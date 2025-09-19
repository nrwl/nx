import {
  cleanupProject,
  newProject,
  runCLI,
  runCommandUntil,
  runE2ETests,
  uniq,
  killPort,
  killProcessAndPorts,
} from '@nx/e2e-utils';

describe('Angular Projects - rspack and playwright', () => {
  beforeAll(() => {
    newProject({ packages: ['@nx/angular'] });
  });

  afterAll(() => cleanupProject());

  it('should successfully work with rspack for build', async () => {
    const app = uniq('app');
    runCLI(
      `generate @nx/angular:app my-dir/${app} --bundler=rspack --no-interactive`
    );
    runCLI(`build ${app}`, {
      env: { NODE_ENV: 'production' },
    });

    if (runE2ETests()) {
      expect(() => runCLI(`e2e ${app}-e2e`)).not.toThrow();
      expect(await killPort(4200)).toBeTruthy();
    }
  }, 1000000);

  it('should successfully work with playwright for e2e tests', async () => {
    const app = uniq('app');

    runCLI(
      `generate @nx/angular:app ${app} --e2eTestRunner=playwright --no-interactive`
    );

    if (runE2ETests('playwright')) {
      expect(() => runCLI(`e2e ${app}-e2e`)).not.toThrow();
      expect(await killPort(4200)).toBeTruthy();
    }
  }, 1000000);
});


