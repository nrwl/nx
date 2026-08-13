import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

describe('Node + vitest', () => {
  beforeAll(() =>
    newProject({
      packages: ['@nx/node', '@nx/nest', '@nx/vitest'],
    })
  );

  afterAll(() => cleanupProject());

  it('should test a node app with vitest', () => {
    const app = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app apps/${app} --framework=fastify --unitTestRunner=vitest --e2eTestRunner=none --linter=eslint --no-interactive`
    );

    checkFilesExist(`apps/${app}/vitest.config.mts`);

    expect(runCLI(`test ${app}`)).toContain(
      `Successfully ran target test for project ${app}`
    );
  });

  // A node app without the fastify template ships no spec file, so the test
  // target only passes if the generated config sets `passWithNoTests`.
  it('should test a node app that has no spec files', () => {
    const app = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app apps/${app} --framework=express --unitTestRunner=vitest --e2eTestRunner=none --linter=eslint --no-interactive`
    );

    expect(runCLI(`test ${app}`)).toContain(
      `Successfully ran target test for project ${app}`
    );
  });

  it('should test a node lib with vitest', () => {
    const lib = uniq('nodelib');

    runCLI(
      `generate @nx/node:lib libs/${lib} --unitTestRunner=vitest --linter=eslint --no-interactive`
    );

    checkFilesExist(`libs/${lib}/vitest.config.mts`);

    expect(runCLI(`test ${lib}`)).toContain(
      `Successfully ran target test for project ${lib}`
    );
  });

  it('should test a nest app with vitest', () => {
    const app = uniq('nestapp');

    runCLI(
      `generate @nx/nest:app apps/${app} --unitTestRunner=vitest --e2eTestRunner=none --linter=eslint --no-interactive`
    );

    checkFilesExist(
      `apps/${app}/vitest.config.mts`,
      `apps/${app}/src/app/app.controller.spec.ts`
    );

    expect(runCLI(`test ${app}`)).toContain(
      `Successfully ran target test for project ${app}`
    );
  });

  it('should test a nest lib with vitest', () => {
    const lib = uniq('nestlib');

    runCLI(
      `generate @nx/nest:lib libs/${lib} --service --unitTestRunner=vitest --linter=eslint --no-interactive`
    );

    checkFilesExist(
      `libs/${lib}/vitest.config.mts`,
      `libs/${lib}/src/lib/${lib}.service.spec.ts`
    );

    expect(runCLI(`test ${lib}`)).toContain(
      `Successfully ran target test for project ${lib}`
    );
  });
});
