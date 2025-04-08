import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  uniq,
} from '@nx/e2e/utils';

describe('Remix - TS solution setup', () => {
  beforeAll(() => {
    newProject({
      packages: ['@nx/remix'],
      preset: 'ts',
    });
  });

  afterAll(() => {
    cleanupProject();
  });

  it('should generate apps and libraries with jest and vitest and work correctly', async () => {
    const appJest = uniq('app-jest');
    const appVitest = uniq('app-vitest');
    const libJest = uniq('lib-jest');
    const buildableLibJest = uniq('buildable-lib-jest');
    const libVitest = uniq('lib-vitest');
    const buildableLibVitest = uniq('buildable-lib-vitest');

    runCLI(
      `generate @nx/remix:application apps/${appVitest} --unitTestRunner=vitest --linter=eslint`
    );
    runCLI(
      `generate @nx/remix:library libs/${libVitest} --unitTestRunner=vitest --linter=eslint`
    );
    runCLI(
      `generate @nx/remix:library libs/${buildableLibVitest} --unitTestRunner=vitest --linter=eslint --buildable`
    );
    runCLI(
      `generate @nx/remix:application apps/${appJest} --unitTestRunner=jest --linter=eslint`
    );
    runCLI(
      `generate @nx/remix:library libs/${libJest} --unitTestRunner=jest --linter=eslint`
    );
    runCLI(
      `generate @nx/remix:library libs/${buildableLibJest} --unitTestRunner=jest --linter=eslint --buildable`
    );

    // typecheck
    expect(runCLI(`typecheck ${appVitest}`)).toContain(
      `Successfully ran target typecheck for project @proj/${appVitest}`
    );
    expect(runCLI(`typecheck ${libVitest}`)).toContain(
      `Successfully ran target typecheck for project @proj/${libVitest}`
    );
    expect(runCLI(`typecheck ${buildableLibVitest}`)).toContain(
      `Successfully ran target typecheck for project @proj/${buildableLibVitest}`
    );
    expect(runCLI(`typecheck ${appJest}`)).toContain(
      `Successfully ran target typecheck for project @proj/${appJest}`
    );
    expect(runCLI(`typecheck ${libJest}`)).toContain(
      `Successfully ran target typecheck for project @proj/${libJest}`
    );
    expect(runCLI(`typecheck ${buildableLibJest}`)).toContain(
      `Successfully ran target typecheck for project @proj/${buildableLibJest}`
    );

    // lint
    expect(runCLI(`lint ${appVitest}`)).toContain(
      `Successfully ran target lint for project @proj/${appVitest}`
    );
    expect(runCLI(`lint ${libVitest}`)).toContain(
      `Successfully ran target lint for project @proj/${libVitest}`
    );
    expect(runCLI(`lint ${buildableLibVitest}`)).toContain(
      `Successfully ran target lint for project @proj/${buildableLibVitest}`
    );
    expect(runCLI(`lint ${appJest}`)).toContain(
      `Successfully ran target lint for project @proj/${appJest}`
    );
    expect(runCLI(`lint ${libJest}`)).toContain(
      `Successfully ran target lint for project @proj/${libJest}`
    );
    expect(runCLI(`lint ${buildableLibJest}`)).toContain(
      `Successfully ran target lint for project @proj/${buildableLibJest}`
    );

    // build
    expect(runCLI(`build ${appVitest}`)).toContain(
      `Successfully ran target build for project @proj/${appVitest}`
    );
    expect(runCLI(`build ${buildableLibVitest}`)).toContain(
      `Successfully ran target build for project @proj/${buildableLibVitest}`
    );
    expect(runCLI(`build ${appJest}`)).toContain(
      `Successfully ran target build for project @proj/${appJest}`
    );
    expect(runCLI(`build ${buildableLibJest}`)).toContain(
      `Successfully ran target build for project @proj/${buildableLibJest}`
    );

    // test
    expect(runCLI(`test ${appVitest}`)).toContain(
      `Successfully ran target test for project @proj/${appVitest}`
    );
    expect(runCLI(`test ${libVitest}`)).toContain(
      `Successfully ran target test for project @proj/${libVitest}`
    );
    expect(runCLI(`test ${buildableLibVitest}`)).toContain(
      `Successfully ran target test for project @proj/${buildableLibVitest}`
    );
    expect(runCLI(`test ${appJest}`)).toContain(
      `Successfully ran target test for project @proj/${appJest}`
    );
    expect(runCLI(`test ${libJest}`)).toContain(
      `Successfully ran target test for project @proj/${libJest}`
    );
    expect(runCLI(`test ${buildableLibJest}`)).toContain(
      `Successfully ran target test for project @proj/${buildableLibJest}`
    );
  }, 120_000);

  it('should respect and support generating libraries with a name different than the import path', async () => {
    const lib = uniq('lib');

    runCLI(
      `generate @nx/remix:library packages/${lib} --name=${lib} --linter=eslint --unitTestRunner=vitest --buildable`
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
  }, 120_000);
});
