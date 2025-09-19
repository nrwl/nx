import {
  checkFilesDoNotExist,
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  runE2ETests,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { names } from '@nx/devkit';

describe('Angular Cypress Component Tests - buildable lib and tailwind', () => {
  beforeAll(async () => {
    newProject({ name: uniq('cy-ng'), packages: ['@nx/angular'] });
  });

  afterAll(() => cleanupProject());

  it('should test buildable lib not being used in app and then with tailwind', () => {
    const appName = uniq('cy-angular-app');
    const buildableLibName = uniq('cy-angular-buildable-lib');

    runCLI(
      `generate @nx/angular:app ${appName} --bundler=webpack --no-interactive`
    );
    runCLI(
      `generate @nx/angular:lib ${buildableLibName} --buildable --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${buildableLibName}/src/lib/input/input.component --inlineTemplate --inlineStyle --export --no-interactive`
    );
    runCLI(
      `generate @nx/angular:component ${buildableLibName}/src/lib/input-standalone/input-standalone --inlineTemplate --inlineStyle --export --standalone --no-interactive`
    );

    createFile(
      `${buildableLibName}/src/lib/input/input.component.cy.ts`,
      `
import { MountConfig } from 'cypress/angular';
import { InputComponent } from './input.component';

describe(InputComponent.name, () => {
  const config: MountConfig<InputComponent> = {
    declarations: [],
    imports: [],
    providers: [],
  };

  it('renders', () => {
    cy.mount(InputComponent, config);
    // make sure tailwind isn't getting applied
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  });
  it('should be readonly', () => {
    cy.mount(InputComponent, {
      ...config,
      componentProperties: {
        readOnly: true,
      },
    });
    cy.get('input').should('have.attr', 'readonly');
  });
});
`
    );

    createFile(
      `${buildableLibName}/src/lib/input-standalone/input-standalone.cy.ts`,
      `
import { MountConfig } from 'cypress/angular';
import { InputStandalone } from './input-standalone';

describe(InputStandalone.name, () => {
  const config: MountConfig<InputStandalone> = {
    declarations: [],
    imports: [],
    providers: [],
  };

  it('renders', () => {
    cy.mount(InputStandalone, config);
    // make sure tailwind isn't getting applied
    cy.get('label').should('have.css', 'color', 'rgb(0, 0, 0)');
  });
  it('should be readonly', () => {
    cy.mount(InputStandalone, {
      ...config,
      componentProperties: {
        readOnly: true,
      },
    });
    cy.get('input').should('have.attr', 'readonly');
  });
});
`
    );

    expect(() => {
      runCLI(
        `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --no-interactive`
      );
    }).toThrow();

    runCLI(
      `generate @nx/angular:cypress-component-configuration --project=${buildableLibName} --generate-tests --build-target=${appName}:build --no-interactive`
    );
    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
      checkFilesDoNotExist(`tmp${buildableLibName}/ct-styles.css`);
    }

    runCLI(`generate @nx/angular:setup-tailwind --project=${buildableLibName}`);
    updateFile(
      `${buildableLibName}/src/lib/input/input.component.cy.ts`,
      (content) => content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)')
    );
    updateFile(
      `${buildableLibName}/src/lib/input-standalone/input-standalone.cy.ts`,
      (content) => content.replace('rgb(0, 0, 0)', 'rgb(34, 197, 94)')
    );

    if (runE2ETests('cypress')) {
      expect(runCLI(`component-test ${buildableLibName}`)).toContain(
        'All specs passed!'
      );
    }
  }, 300_000);
});
