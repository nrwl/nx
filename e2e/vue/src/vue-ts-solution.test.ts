import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e/utils';

describe('Vue (TS solution)', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/vue'],
      preset: 'ts',
    });
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

    expect(() => runCLI(`lint @proj/${app}`)).not.toThrow();
    expect(() => runCLI(`test @proj/${app}`)).not.toThrow();
    expect(() => runCLI(`build @proj/${app}`)).not.toThrow();
    expect(() => runCLI(`lint @proj/${lib}`)).not.toThrow();
    expect(() => runCLI(`test @proj/${lib}`)).not.toThrow();
    expect(() => runCLI(`build @proj/${lib}`)).not.toThrow();
  }, 300_000);

  it('should respect and support generating libraries with a name different than the import path', async () => {
    const lib = uniq('lib');

    runCLI(
      `generate @nx/vue:library packages/${lib} --name=${lib} --bundler=vite --unitTestRunner=vitest --linter=eslint`
    );

    const packageJson = readJson(`packages/${lib}/package.json`);
    expect(packageJson.nx.name).toBe(lib);

    expect(runCLI(`build ${lib}`)).toContain(
      `Successfully ran target build for project ${lib}`
    );
    expect(runCLI(`typecheck ${lib}`)).toContain(
      `Successfully ran target typecheck for project ${lib}`
    );
    expect(runCLI(`lint ${lib}`)).toContain(
      `Successfully ran target lint for project ${lib}`
    );
    expect(runCLI(`test ${lib}`)).toContain(
      `Successfully ran target test for project ${lib}`
    );
  }, 300_000);
});
