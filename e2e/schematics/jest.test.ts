import {
  newProject,
  runCLI,
  newLib,
  runCLIAsync,
  newApp,
  copyMissingPackages,
  ensureProject,
  uniq
} from '../utils';

describe('Jest', () => {
  it('should be able to generate a testable library using jest', async done => {
    ensureProject();
    const mylib = uniq('mylib');
    newLib(`${mylib} --unit-test-runner jest --framework=angular`);

    await Promise.all([
      runCLIAsync(`generate service test --project ${mylib}`),
      runCLIAsync(`generate component test --project ${mylib}`)
    ]);
    const jestResult = await runCLIAsync(`test ${mylib}`);
    expect(jestResult.stderr).toContain('Test Suites: 3 passed, 3 total');
    done();
  }, 10000);

  it('should be able to generate a testable application using jest', async () => {
    ensureProject();
    const myapp = uniq('myapp');
    newApp(`${myapp} --unit-test-runner jest --framework=angular`);

    await Promise.all([
      runCLIAsync(`generate service test --project ${myapp}`),
      runCLIAsync(`generate component test --project ${myapp}`)
    ]);
    const jestResult = await runCLIAsync(`test ${myapp}`);
    expect(jestResult.stderr).toContain('Test Suites: 3 passed, 3 total');
  }, 10000);
});
