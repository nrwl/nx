import {
  cleanupProject,
  getSelectedPackageManager,
  newProject,
  runCLI,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';

describe('Vue Plugin', () => {
  let proj: string;

  const pm = getSelectedPackageManager();

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/vue'],
      preset: 'ts',
    });
    if (pm === 'pnpm') {
      updateFile(
        'pnpm-workspace.yaml',
        `
packages:
  - 'apps/*'
  - 'packages/*'
`
      );
    } else {
      updateJson('package.json', (json) => {
        json.workspaces = ['apps/*', 'packages/*'];
        return json;
      });
    }
  });

  afterAll(() => cleanupProject());

  it('should serve application in dev mode', async () => {
    const app = uniq('app');
    const lib = uniq('lib');
    runCLI(
      `generate @nx/vue:app apps/${app} --unitTestRunner=vitest --e2eTestRunner=playwright --linter=eslint`
    );
    runCLI(
      `generate @nx/vue:lib packages/${lib} --bundler=vite --unitTestRunner=vitest --linter=eslint`
    );

    // app and lib generators don't have specs by default, add some stubs
    updateFile(
      `apps/${app}/src/foo.spec.ts`,
      `
    test('it should run', () => {
      expect(true).toBeTruthy();
    });
    `
    );
    updateFile(
      `packages/${lib}/src/foo.spec.ts`,
      `
    test('it should run', () => {
      expect(true).toBeTruthy();
    });
    `
    );

    expect(() => runCLI(`lint ${app}`)).not.toThrow();
    expect(() => runCLI(`test ${app}`)).not.toThrow();
    expect(() => runCLI(`build ${app}`)).not.toThrow();
    expect(() => runCLI(`lint ${lib}`)).not.toThrow();
    expect(() => runCLI(`test ${lib}`)).not.toThrow();
    expect(() => runCLI(`build ${lib}`)).not.toThrow();
  }, 300_000);
});
