import {
  checkFilesExist,
  cleanupProject,
  newProject,
  runCLI,
  uniq,
} from '@nx/e2e-utils';

/**
 * `Successfully ran target test` is also printed when vitest collects nothing,
 * so every case that owns a spec asserts the passed-test count too.
 */
function expectTestsPassed(output: string, project: string, count: number) {
  expect(output).toContain(
    `Successfully ran target test for project ${project}`
  );
  expect(output).toMatch(new RegExp(`Tests\\s+${count} passed`));
}

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

    checkFilesExist(
      `apps/${app}/vitest.config.mts`,
      `apps/${app}/src/app/app.spec.ts`
    );

    expectTestsPassed(runCLI(`test ${app}`), app, 1);
  });

  // A node app without the fastify template ships no spec file, so the test
  // target only passes if the generated config sets `passWithNoTests`.
  it('should test a node app that has no spec files', () => {
    const app = uniq('nodeapp');

    runCLI(
      `generate @nx/node:app apps/${app} --framework=express --unitTestRunner=vitest --e2eTestRunner=none --linter=eslint --no-interactive`
    );

    const output = runCLI(`test ${app}`);
    expect(output).toContain(`Successfully ran target test for project ${app}`);
    expect(output).toContain('No test files found');
  });

  it('should test a node lib with vitest', () => {
    const lib = uniq('nodelib');

    runCLI(
      `generate @nx/node:lib libs/${lib} --unitTestRunner=vitest --linter=eslint --no-interactive`
    );

    checkFilesExist(
      `libs/${lib}/vitest.config.mts`,
      `libs/${lib}/src/lib/${lib}.spec.ts`
    );

    expectTestsPassed(runCLI(`test ${lib}`), lib, 1);
  });

  it('should test a nest app with vitest', () => {
    const app = uniq('nestapp');

    runCLI(
      `generate @nx/nest:app apps/${app} --unitTestRunner=vitest --e2eTestRunner=none --linter=eslint --no-interactive`
    );

    checkFilesExist(
      `apps/${app}/vitest.config.mts`,
      `apps/${app}/src/app/app.controller.spec.ts`,
      `apps/${app}/src/app/app.service.spec.ts`
    );

    // Nest DI needs `design:paramtypes`, which only lands if the transform
    // honors `emitDecoratorMetadata` -- esbuild does not.
    expectTestsPassed(runCLI(`test ${app}`), app, 2);
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

    expectTestsPassed(runCLI(`test ${lib}`), lib, 1);
  });
});
