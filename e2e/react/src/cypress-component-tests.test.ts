import { createFile, newProject, runCLI, uniq, updateFile } from '../../utils';

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

  it('should successfully test react lib', () => {
    const libName = uniq('cy-react-lib');
    const appName = uniq('cy-react-app-target');
    runCLI(`generate @nrwl/react:app ${appName} --no-interactive`);
    runCLI(`generate @nrwl/react:lib ${libName} --component --no-interactive`);
    runCLI(
      `generate @nrwl/react:setup-tailwind --project=${libName} --no-interactive`
    );
    runCLI(
      `generate @nrwl/react:component fancy-component --project=${libName} --no-interactive`
    );
    createFile(
      `libs/${libName}/src/styles.css`,
      `
@tailwind components;
@tailwind base;
@tailwind utilities;
`
    );
    updateFile(
      `libs/${libName}/src/lib/fancy-component/fancy-component.tsx`,
      (content) => {
        return `
import '../../styles.css';
${content}`;
      }
    );
    runCLI(
      `generate @nrwl/react:cypress-component-configuration --project=${libName} --build-target=${appName}:build --generate-tests`
    );
    expect(runCLI(`component-test ${libName} --no-watch`)).toContain(
      'All specs passed!'
    );
  }, 1000000);
});
