import { newLib, runCLIAsync, newApp, ensureProject, uniq } from '../utils';

describe('Jest', () => {
  it('should be able test projects using jest', async done => {
    ensureProject();
    const mylib = uniq('mylib');
    const myapp = uniq('myapp');
    newApp(`${myapp} --unit-test-runner jest --framework=angular`);
    newLib(`${mylib} --unit-test-runner jest --framework=angular`);

    await Promise.all([
      runCLIAsync(`generate service test --project ${myapp}`),
      runCLIAsync(`generate component test --project ${myapp}`),
      runCLIAsync(`generate service test --project ${mylib}`),
      runCLIAsync(`generate component test --project ${mylib}`)
    ]);
    const appResult = await runCLIAsync(`test ${myapp}`);
    expect(appResult.stderr).toContain('Test Suites: 3 passed, 3 total');
    const libResult = await runCLIAsync(`test ${mylib}`);
    expect(libResult.stderr).toContain('Test Suites: 3 passed, 3 total');
    done();
  }, 45000);
});
