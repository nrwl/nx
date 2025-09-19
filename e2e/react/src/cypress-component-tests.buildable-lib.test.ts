import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';

describe('React Cypress Component Tests - buildable lib', () => {
  beforeAll(async () => {
    newProject({ name: uniq('cy-react'), packages: ['@nx/react'] });
  });

  afterAll(() => cleanupProject());

  it('should test buildable lib not being used in app and with tailwind', () => {
    const appName = uniq('cy-react-app');
    const buildableLibName = uniq('cy-react-buildable-lib');

    runCLI(
      `generate @nx/react:app apps/${appName} --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/react:lib libs/${buildableLibName} --buildable --no-interactive --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/react:component libs/${buildableLibName}/src/lib/input/input --export --no-interactive`
    );

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
    }

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
    }
  }, 300_000);
});


