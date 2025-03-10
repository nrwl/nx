import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('React (TS solution)', () => {
  let workspaceName: string;

  beforeAll(() => {
    workspaceName = newProject({ preset: 'ts', packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should respect and support generating libraries with a name different than the import path', async () => {
    const lib = uniq('lib');

    runCLI(
      `generate @nx/react:library packages/${lib} --name=${lib} --bundler=vite --linter=eslint --unitTestRunner=vitest`
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
  }, 90000);
});
