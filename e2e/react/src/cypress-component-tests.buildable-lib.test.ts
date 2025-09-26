import { createFile, runCLI, runE2ETests, updateFile } from '@nx/e2e-utils';
import { join } from 'path';

import {
  setupReactCypressSuite,
  teardownReactCypressSuite,
} from './cypress-component-tests.setup';

describe('React Cypress Component Tests - buildable library', () => {
  const context = setupReactCypressSuite();

  afterAll(() => teardownReactCypressSuite());

  it('should test buildable lib not being used in app', () => {
    createFile(
      `libs/${context.buildableLibName}/src/lib/input/input.cy.tsx`,
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
      `generate @nx/react:cypress-component-configuration --project=${context.buildableLibName} --generate-tests --build-target=${context.appName}:build`
    );

    if (runE2ETests()) {
      expect(
        runCLI(`component-test ${context.buildableLibName} --no-watch`)
      ).toContain('All specs passed!');
    }

    runCLI(
      `generate @nx/react:setup-tailwind --project=${context.buildableLibName}`
    );
    updateFile(
      `libs/${context.buildableLibName}/src/styles.css`,
      `
@tailwind components;
@tailwind base;
@tailwind utilities;
`
    );
    updateFile(
      `libs/${context.buildableLibName}/src/lib/input/input.cy.tsx`,
      (content) => content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)')
    );
    updateFile(
      `libs/${context.buildableLibName}/src/lib/input/input.tsx`,
      (content) => `import '../../styles.css';
${content}`
    );

    if (runE2ETests()) {
      expect(
        runCLI(`component-test ${context.buildableLibName} --no-watch`)
      ).toContain('All specs passed!');
    }
  }, 300_000);
});
