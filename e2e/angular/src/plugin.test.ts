import {
  checkFilesExist,
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  isVerbose,
  isVerboseE2ERun,
  logInfo,
  newProject,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { angularCliVersion } from '@nx/workspace/src/utils/versions';
import { ensureDirSync } from 'fs-extra';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

describe('Angular Crystal Plugin', () => {
  let proj: string;

  beforeAll(() => {
    proj = newProject({
      packages: ['@nx/angular'],
    });

    if (getSelectedPackageManager() === 'pnpm') {
      updateFile(
        'pnpm-workspace.yaml',
        `packages:
  - 'projects/*'
`
      );
    } else {
      updateJson('package.json', (json) => {
        json.workspaces = ['projects/*'];
        return json;
      });
    }
  });

  afterAll(() => cleanupProject());

  it('should infer tasks from multiple angular.json files', () => {
    const ngOrg1App1 = uniq('ng-org1-app1');
    const ngOrg1Lib1 = uniq('ng-org1-lib1');
    const org1Root = join(tmpProjPath(), 'projects', ngOrg1App1);
    const ngOrg2App1 = uniq('ng-org2-app1');
    const ngOrg2Lib1 = uniq('ng-org2-lib1');
    const org2Root = join(tmpProjPath(), 'projects', ngOrg2App1);
    const pmc = getPackageManagerCommand();

    // first angular inner repo (e.g. imported with nx import)
    runNgNew(ngOrg1App1, 'projects');
    // exclude scripts from nx, to prevent them to override the inferred tasks
    updateJson(`projects/${ngOrg1App1}/package.json`, (json) => {
      json.nx = { includedScripts: [] };
      return json;
    });
    runCommand(pmc.run(`ng g @schematics/angular:library ${ngOrg1Lib1}`, ''), {
      cwd: org1Root,
    });

    // second angular inner repo
    runNgNew(ngOrg2App1, 'projects');
    // exclude scripts from nx
    updateJson(`projects/${ngOrg2App1}/package.json`, (json) => {
      json.nx = { includedScripts: [] };
      return json;
    });
    runCommand(pmc.run(`ng g @schematics/angular:library ${ngOrg2Lib1}`, ''), {
      cwd: org2Root,
    });

    // add Angular Crystal plugin
    updateJson('nx.json', (json) => {
      json.plugins ??= [];
      json.plugins.push('@nx/angular/plugin');
      return json;
    });

    // check org1 tasks

    // build
    runCLI(`build ${ngOrg1App1} --output-hashing none`);
    checkFilesExist(
      `projects/${ngOrg1App1}/dist/${ngOrg1App1}/browser/main.js`
    );
    expect(runCLI(`build ${ngOrg1App1} --output-hashing none`)).toContain(
      'Nx read the output from the cache instead of running the command for 1 out of 1 tasks'
    );
    runCLI(`build ${ngOrg1Lib1}`);
    checkFilesExist(
      `projects/${ngOrg1App1}/dist/${ngOrg1Lib1}/fesm2022/${ngOrg1Lib1}.mjs`
    );
    expect(runCLI(`build ${ngOrg1Lib1}`)).toContain(
      'Nx read the output from the cache instead of running the command for 1 out of 1 tasks'
    );

    // test
    expect(
      runCLI(
        `run-many -t test -p ${ngOrg1App1},${ngOrg1Lib1} --no-watch --browsers=ChromeHeadless`
      )
    ).toContain('Successfully ran target test for 2 projects');
    expect(
      runCLI(
        `run-many -t test -p ${ngOrg1App1},${ngOrg1Lib1} --no-watch --browsers=ChromeHeadless`
      )
    ).toContain(
      'Nx read the output from the cache instead of running the command for 2 out of 2 tasks'
    );

    // check org2 tasks

    // build
    runCLI(`build ${ngOrg2App1} --output-hashing none`);
    checkFilesExist(
      `projects/${ngOrg2App1}/dist/${ngOrg2App1}/browser/main.js`
    );
    expect(runCLI(`build ${ngOrg2App1} --output-hashing none`)).toContain(
      'Nx read the output from the cache instead of running the command for 1 out of 1 tasks'
    );
    runCLI(`build ${ngOrg2Lib1}`);
    checkFilesExist(
      `projects/${ngOrg2App1}/dist/${ngOrg2Lib1}/fesm2022/${ngOrg2Lib1}.mjs`
    );
    expect(runCLI(`build ${ngOrg2Lib1}`)).toContain(
      'Nx read the output from the cache instead of running the command for 1 out of 1 tasks'
    );

    // test
    expect(
      runCLI(
        `run-many -t test -p ${ngOrg2App1},${ngOrg2Lib1} --no-watch --browsers=ChromeHeadless`
      )
    ).toContain('Successfully ran target test for 2 projects');
    expect(
      runCLI(
        `run-many -t test -p ${ngOrg2App1},${ngOrg2Lib1} --no-watch --browsers=ChromeHeadless`
      )
    ).toContain(
      'Nx read the output from the cache instead of running the command for 2 out of 2 tasks'
    );
  });
});

function runNgNew(projectName: string, cwd: string): void {
  const packageManager = getSelectedPackageManager();
  const pmc = getPackageManagerCommand({ packageManager });

  const command = `${pmc.runUninstalledPackage} @angular/cli@${angularCliVersion} new ${projectName} --package-manager=${packageManager}`;
  cwd = join(tmpProjPath(), cwd);
  ensureDirSync(cwd);
  execSync(command, {
    cwd,
    stdio: isVerbose() ? 'inherit' : 'pipe',
    env: process.env,
    encoding: 'utf-8',
  });

  if (isVerboseE2ERun()) {
    logInfo(
      `NX`,
      `E2E created an Angular CLI project at ${join(cwd, projectName)}`
    );
  }
}
