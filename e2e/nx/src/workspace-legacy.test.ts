import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
} from '@nx/e2e/utils';

let proj: string;

describe('@nx/workspace:convert-to-monorepo', () => {
  beforeEach(() => {
    proj = newProject({ packages: ['@nx/react', '@nx/js'] });
  });

  afterEach(() => cleanupProject());

  it('should convert a standalone webpack and jest react project to a monorepo (legacy)', async () => {
    const reactApp = uniq('reactapp');
    runCLI(
      `generate @nx/react:app ${reactApp} --rootProject=true --bundler=webpack --unitTestRunner=jest --e2eTestRunner=cypress --no-interactive`,
      {
        env: {
          NX_ADD_PLUGINS: 'false',
        },
      }
    );

    runCLI('generate @nx/workspace:convert-to-monorepo --no-interactive', {
      env: {
        NX_ADD_PLUGINS: 'false',
      },
    });

    checkFilesExist(
      `apps/${reactApp}/src/main.tsx`,
      `apps/e2e/cypress.config.ts`
    );

    expect(() => runCLI(`build ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`test ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`lint ${reactApp}`)).not.toThrow();
    expect(() => runCLI(`lint e2e`)).not.toThrow();
    if (runE2ETests()) {
      expect(() => runCLI(`e2e e2e`)).not.toThrow();
    }
  });
});
