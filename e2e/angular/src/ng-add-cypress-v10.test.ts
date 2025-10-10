import {
  checkFilesDoNotExist,
  checkFilesExist,
  packageInstall,
  readJson,
  runCLI,
  runNgAdd,
} from '@nx/e2e-utils';
import {
  setupNgAddTest,
  cleanupNgAddTest,
  NgAddTestContext,
} from './ng-add-setup';

function addCypress10(project: string) {
  runNgAdd('@cypress/schematic', '--e2e', 'latest');
  // pin latest version of Cypress that's supported by Nx to avoid flakiness
  // when a new major version is released
  packageInstall('cypress', null, '^14.2.1');
}

describe('convert Angular CLI workspace to an Nx workspace', () => {
  let context: NgAddTestContext;

  beforeEach(() => {
    context = setupNgAddTest();
  });

  afterEach(() => {
    cleanupNgAddTest();
  });

  it('should handle a workspace with cypress v10', () => {
    const { project } = context;
    addCypress10(project);

    runCLI('g @nx/angular:ng-add --skip-install');

    const e2eProject = `${project}-e2e`;
    //check e2e project files
    checkFilesDoNotExist(
      'cypress.config.ts',
      'cypress/tsconfig.json',
      'cypress/e2e/spec.cy.ts',
      'cypress/fixtures/example.json',
      'cypress/support/commands.ts',
      'cypress/support/e2e.ts'
    );
    checkFilesExist(
      `apps/${e2eProject}/cypress.config.ts`,
      `apps/${e2eProject}/tsconfig.json`,
      `apps/${e2eProject}/src/e2e/spec.cy.ts`,
      `apps/${e2eProject}/src/fixtures/example.json`,
      `apps/${e2eProject}/src/support/commands.ts`,
      `apps/${e2eProject}/src/support/e2e.ts`
    );

    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.targets['cypress-run']).toBeUndefined();
    expect(projectConfig.targets['cypress-open']).toBeUndefined();
    expect(projectConfig.targets.e2e).toBeUndefined();

    // check e2e project config
    const e2eProjectConfig = readJson(`apps/${project}-e2e/project.json`);
    expect(e2eProjectConfig.targets['cypress-run']).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        cypressConfig: `apps/${e2eProject}/cypress.config.ts`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
    expect(e2eProjectConfig.targets['cypress-open']).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        watch: true,
        headless: false,
        cypressConfig: `apps/${e2eProject}/cypress.config.ts`,
      },
    });
    expect(e2eProjectConfig.targets.e2e).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        watch: true,
        headless: false,
        cypressConfig: `apps/${e2eProject}/cypress.config.ts`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
  });
});
