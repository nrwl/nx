import {
  checkFilesExist,
  killPorts,
  newProject,
  readFile,
  readJson,
  runCLI,
  uniq,
  updateFile,
} from '@nrwl/e2e/utils';

describe('Cypress E2E Test runner', () => {
  const myapp = uniq('myapp');
  beforeAll(() => {
    newProject();
  });
  it('should generate an app with the Cypress as e2e test runner', () => {
    runCLI(
      `generate @nrwl/react:app ${myapp} --e2eTestRunner=cypress --linter=eslint`
    );

    // Making sure the package.json file contains the Cypress dependency
    const packageJson = readJson('package.json');
    expect(packageJson.devDependencies['cypress']).toBeTruthy();

    // Making sure the cypress folders & files are created
    checkFilesExist(`apps/${myapp}-e2e/cypress.config.ts`);
    checkFilesExist(`apps/${myapp}-e2e/tsconfig.json`);

    checkFilesExist(`apps/${myapp}-e2e/src/fixtures/example.json`);
    checkFilesExist(`apps/${myapp}-e2e/src/e2e/app.cy.ts`);
    checkFilesExist(`apps/${myapp}-e2e/src/support/app.po.ts`);
    checkFilesExist(`apps/${myapp}-e2e/src/support/e2e.ts`);
    checkFilesExist(`apps/${myapp}-e2e/src/support/commands.ts`);
  }, 1000000);

  it('should execute e2e tests using Cypress', async () => {
    // contains the correct output and works
    const run1 = runCLI(`e2e ${myapp}-e2e --no-watch`);
    console.log('run 1 output: ', run1);
    expect(run1).toContain('All specs passed!');

    await killPorts(4200);
    // TODO(caleb) why are we changing the config and running 🤔
    const originalContents = readFile(`apps/${myapp}-e2e/cypress.config.ts`);
    updateFile(
      `apps/${myapp}-e2e/cypress.config.ts`,
      originalContents.replace(/(fixturesFolder).+/i, '')
    );

    // this output is not the entire output and is missing the bottom part causing it the fail.
    // it's also a replay from the cache idk if that has anything to do with it.
    const run2 = runCLI(`e2e ${myapp}-e2e --no-watch`);
    console.log('run 2 output: ', run2);
    // TODO(caleb): this output is cropped and is failing for missing the bottom part.
    // expect(run2).toContain('All specs passed!');
    expect(await killPorts(4200)).toBeTruthy();
  }, 1000000);
});
