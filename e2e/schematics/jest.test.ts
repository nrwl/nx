import {
  newProject,
  runCLI,
  newLib,
  runCLIAsync,
  newApp,
  copyMissingPackages
} from '../utils';

describe('Jest', () => {
  beforeAll(() => {
    newProject();
  });

  it(
    'should be able to generate a testable library using jest',
    async done => {
      newLib('jestlib --unit-test-runner jest');
      copyMissingPackages();
      await Promise.all([
        runCLIAsync('generate service test --project jestlib'),
        runCLIAsync('generate component test --project jestlib')
      ]);
      const jestResult = await runCLIAsync('test jestlib');
      expect(jestResult.stderr).toContain('Test Suites: 3 passed, 3 total');
      done();
    },
    10000
  );

  it(
    'should be able to generate a testable application using jest',
    async () => {
      newApp('jestapp --unit-test-runner jest');
      copyMissingPackages();
      await Promise.all([
        runCLIAsync('generate service test --project jestapp'),
        runCLIAsync('generate component test --project jestapp')
      ]);
      const jestResult = await runCLIAsync('test jestapp');
      expect(jestResult.stderr).toContain('Test Suites: 3 passed, 3 total');
    },
    10000
  );
});
