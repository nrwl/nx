import { checkFilesExist, readJson, runCLI, runNgAdd } from '@nx/e2e-utils';
import {
  setupNgAddTest,
  cleanupNgAddTest,
  NgAddTestContext,
} from './ng-add-setup';

function addEsLint(project: string) {
  runNgAdd('@angular-eslint/schematics', undefined, 'latest');
}

describe('convert Angular CLI workspace to an Nx workspace', () => {
  let context: NgAddTestContext;

  beforeEach(() => {
    context = setupNgAddTest();
  });

  afterEach(() => {
    cleanupNgAddTest();
  });

  // TODO(leo): The current Verdaccio setup fails to resolve older versions
  // of @nx/* packages, the @angular-eslint/builder package depends on an
  // older version of @nx/devkit so we skip this test for now.
  it.skip('should handle a workspace with ESLint', () => {
    const { project } = context;
    addEsLint(project);

    runCLI('g @nx/angular:ng-add');

    checkFilesExist(`apps/${project}/.eslintrc.json`, `.eslintrc.json`);

    const projectConfig = readJson(`apps/${project}/project.json`);
    expect(projectConfig.targets.lint).toStrictEqual({
      executor: '@nx/eslint:lint',
    });

    let output = runCLI(`lint ${project}`);
    expect(output).toContain(`> nx run ${project}:lint`);
    expect(output).toContain('All files pass linting');
    expect(output).toContain(
      `Successfully ran target lint for project ${project}`
    );

    output = runCLI(`lint ${project}`);
    expect(output).toContain(`> nx run ${project}:lint  [local cache]`);
    expect(output).toContain('All files pass linting');
    expect(output).toContain(
      `Successfully ran target lint for project ${project}`
    );
  });
});
