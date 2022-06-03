import { newProject, runCLI, uniq } from '../../utils';

describe('Next Cypress Component Tests', () => {
  beforeAll(() => newProject());

  it('should successfully test react app', () => {
    const appName = uniq('cy-react-app');
    runCLI(`generate @nrwl/next:app ${appName} --no-interactive`);
    runCLI(
      `generate @nrwl/next:component fancy-component --project=${appName} --directory=components --no-interactive`
    );
    runCLI(
      `generate @nrwl/next:cypress-component-configuration --project=${appName} --generate-tests`
    );
    expect(runCLI(`component-test ${appName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);

  it('should successfully test react app', () => {
    const libName = uniq('cy-react-lib');
    runCLI(`generate @nrwl/next:lib ${libName} --component --no-interactive`);
    runCLI(
      `generate @nrwl/next:component fancy-component --project=${libName} --no-interactive`
    );
    runCLI(
      `generate @nrwl/next:cypress-component-configuration --project=${libName} --generate-tests`
    );
    expect(runCLI(`component-test ${libName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);
});
