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

function addCypress9(project: string) {
  runNgAdd('@cypress/schematic', '--e2e-update', '1.7.0');
  packageInstall('cypress', null, '^9.0.0');
}

describe('convert Angular CLI workspace to an Nx workspace', () => {
  let context: NgAddTestContext;

  beforeEach(() => {
    context = setupNgAddTest();
  });

  afterEach(() => {
    cleanupNgAddTest();
  });

  it('should handle a workspace with cypress v9', () => {
    const { project } = context;
    addCypress9(project);

    runCLI('g @nx/angular:ng-add --skip-install');

    const e2eProject = `${project}-e2e`;
    //check e2e project files
    checkFilesDoNotExist(
      'cypress.json',
      'cypress/tsconfig.json',
      'cypress/integration/spec.ts',
      'cypress/plugins/index.ts',
      'cypress/support/commands.ts',
      'cypress/support/index.ts'
    );
    checkFilesExist(
      `apps/${e2eProject}/cypress.json`,
      `apps/${e2eProject}/tsconfig.json`,
      `apps/${e2eProject}/src/integration/spec.ts`,
      `apps/${e2eProject}/src/plugins/index.ts`,
      `apps/${e2eProject}/src/support/commands.ts`,
      `apps/${e2eProject}/src/support/index.ts`
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
        cypressConfig: `apps/${e2eProject}/cypress.json`,
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
        cypressConfig: `apps/${e2eProject}/cypress.json`,
      },
    });
    expect(e2eProjectConfig.targets.e2e).toEqual({
      executor: '@nx/cypress:cypress',
      options: {
        devServerTarget: `${project}:serve`,
        watch: true,
        headless: false,
        cypressConfig: `apps/${e2eProject}/cypress.json`,
      },
      configurations: {
        production: {
          devServerTarget: `${project}:serve:production`,
        },
      },
    });
  });
});
