import { newProject, runCLI, uniq } from '../../utils';

describe('Angular Cypress Component Tests', () => {
  beforeAll(() => newProject());

  it('should successfully test angular app', () => {
    const appName = uniq('cy-angular-app');
    runCLI(`generate @nrwl/angular:app ${appName} --no-interactive`);
    runCLI(
      `generate @nrwl/angular:component fancy-component --project=${appName} --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${appName} --generate-tests`
    );
    expect(runCLI(`component-test ${appName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);

  it('should successfully test angular app', () => {
    const libName = uniq('cy-angular-lib');
    runCLI(
      `generate @nrwl/angular:lib ${libName} --component --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:component fancy-component --project=${libName} --no-interactive`
    );
    runCLI(
      `generate @nrwl/angular:cypress-component-configuration --project=${libName} --generate-tests`
    );
    expect(runCLI(`component-test ${libName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);
});
