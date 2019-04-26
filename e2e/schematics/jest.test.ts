import { runCLIAsync, ensureProject, uniq, runCLI } from '../utils';

describe('Jest', () => {
  it('should be able test projects using jest', async done => {
    ensureProject();
    const mylib = uniq('mylib');
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/angular:app ${myapp} --unit-test-runner jest`);
    runCLI(`generate @nrwl/angular:lib ${mylib} --unit-test-runner jest`);

    await Promise.all([
      runCLIAsync(`generate @nrwl/angular:service test --project ${myapp}`),
      runCLIAsync(`generate @nrwl/angular:component test --project ${myapp}`),
      runCLIAsync(`generate @nrwl/angular:service test --project ${mylib}`),
      runCLIAsync(`generate @nrwl/angular:component test --project ${mylib}`)
    ]);
    const appResult = await runCLIAsync(`test ${myapp}`);
    expect(appResult.stderr).toContain('Test Suites: 3 passed, 3 total');
    const libResult = await runCLIAsync(`test ${mylib}`);
    expect(libResult.stderr).toContain('Test Suites: 3 passed, 3 total');
    done();
  }, 45000);
});
