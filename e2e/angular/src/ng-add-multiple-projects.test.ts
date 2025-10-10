import {
  checkFilesDoNotExist,
  checkFilesExist,
  runCLI,
  runCommand,
  uniq,
} from '@nx/e2e-utils';
import {
  setupNgAddTest,
  cleanupNgAddTest,
  NgAddTestContext,
} from './ng-add-setup';

describe('convert Angular CLI workspace to an Nx workspace', () => {
  let context: NgAddTestContext;

  beforeEach(() => {
    context = setupNgAddTest();
  });

  afterEach(() => {
    cleanupNgAddTest();
  });

  it('should support a workspace with multiple projects', () => {
    const { project } = context;
    // add other projects
    const app1 = uniq('app1');
    const lib1 = uniq('lib1');
    runCommand(`ng g @schematics/angular:application ${app1} --no-interactive`);
    runCommand(`ng g @schematics/angular:library ${lib1} --no-interactive`);

    runCLI('g @nx/angular:ng-add');

    // check angular.json does not exist
    checkFilesDoNotExist('angular.json');

    // check building project
    let output = runCLI(`build ${project} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${project}:build:production --outputHashing none`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${project}`
    );
    checkFilesExist(`dist/${project}/browser/main.js`);

    output = runCLI(`build ${project} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${project}:build:production --outputHashing none  [local cache]`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${project}`
    );

    // check building app1
    output = runCLI(`build ${app1} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${app1}:build:production --outputHashing none`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${app1}`
    );
    checkFilesExist(`dist/${app1}/browser/main.js`);

    output = runCLI(`build ${app1} --outputHashing none`);
    expect(output).toContain(
      `> nx run ${app1}:build:production --outputHashing none  [local cache]`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${app1}`
    );

    // check building lib1
    output = runCLI(`build ${lib1}`);
    expect(output).toContain(`> nx run ${lib1}:build:production`);
    expect(output).toContain(
      `Successfully ran target build for project ${lib1}`
    );
    checkFilesExist(`dist/${lib1}/package.json`);

    output = runCLI(`build ${lib1}`);
    expect(output).toContain(
      `> nx run ${lib1}:build:production  [local cache]`
    );
    expect(output).toContain(
      `Successfully ran target build for project ${lib1}`
    );
  });
});
