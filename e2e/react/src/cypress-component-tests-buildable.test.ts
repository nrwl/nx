import {
  cleanupProject,
  createFile,
  killPort,
  runCLI,
  runE2ETests,
  updateFile,
} from '@nx/e2e-utils';
import { setupCypressComponentTests } from './cypress-component-tests-setup';

describe('React Cypress Component Tests - buildable lib', () => {
  let projectName;
  let appName;
  let buildableLibName;

  beforeAll(async () => {
    const setup = setupCypressComponentTests();
    projectName = setup.projectName;
    appName = setup.appName;
    buildableLibName = setup.buildableLibName;
  });

  afterAll(() => {
    cleanupProject();
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should test buildable lib not being used in app', async () => {
    createFile(
      `libs/${buildableLibName}/src/lib/input/input.cy.tsx`,
      `
import * as React from 'react'
import Input from './input'


describe(Input.name, () => {
  it('renders', () => {
    cy.mount(<Input readOnly={false} />)
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  })
  it('should be read only', () => {
    cy.mount(<Input readOnly={true}/>)
    cy.get('input').should('have.attr', 'readonly');
  })
});
`
    );

    runCLI(
      `generate @nx/react:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build`
    );

    if (runE2ETests()) {
      expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
      // Kill the dev server port to prevent EADDRINUSE errors
      await killPort(8080);
    }

    // add tailwind
    runCLI(`generate @nx/react:setup-tailwind --project=${buildableLibName}`);
    updateFile(
      `libs/${buildableLibName}/src/styles.css`,
      `
@tailwind components;
@tailwind base;
@tailwind utilities;
`
    );
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.cy.tsx`,
      (content) => {
        // text-green-500 should now apply
        return content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)');
      }
    );
    updateFile(
      `libs/${buildableLibName}/src/lib/input/input.tsx`,
      (content) => {
        return `import '../../styles.css';
${content}`;
      }
    );

    if (runE2ETests()) {
      expect(runCLI(`component-test ${buildableLibName} --no-watch`)).toContain(
        'All specs passed!'
      );
      // Kill the dev server port to clean up
      await killPort(8080);
    }
  }, 300_000);
});
