import { newProject, runCLI, uniq } from '../../utils';

describe('React Cypress Component Tests', () => {
  beforeAll(() => newProject());

  it('should successfully test react app', () => {
    const appName = uniq('cy-react-app');
    runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
    runCLI(
      `generate @nrwl/react:component fancy-component --project=${appName} --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:cypress-component-configuration --project=${appName} --generate-tests`
    );
    expect(runCLI(`component-test ${appName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);

  it('should successfully test react app', () => {
    const libName = uniq('cy-react-lib');
    runCLI(`generate @nrwl/react:lib ${libName} --component --no-interactive`);
    runCLI(
      `generate @nrwl/react:component fancy-component --project=${libName} --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:cypress-component-configuration --project=${libName} --generate-tests`
    );
    expect(runCLI(`component-test ${libName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);
});
