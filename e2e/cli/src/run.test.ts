import {
  getPublishedVersion,
  isNotWindows,
  newProject,
  readFile,
  readJson,
  runCLI,
  runCLIAsync,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { renameSync } from 'fs';
import { packagesWeCareAbout } from 'nx/src/command-line/report';

//
describe('Running targets', () => {
  beforeEach(() => newProject());

  it('should execute long running tasks', async () => {
    const myapp = uniq('myapp');
    runCLI(`generate @nrwl/web:app ${myapp}`);
    updateProjectConfig(myapp, (c) => {
      c.targets['counter'] = {
        executor: '@nrwl/workspace:counter',
        options: {
          to: 2,
        },
      };
      return c;
    });

    const success = runCLI(`counter ${myapp} --result=true`);
    expect(success).toContain('0');
    expect(success).toContain('1');

    expect(() => runCLI(`counter ${myapp} --result=false`)).toThrowError();
  });

  it('should run npm scripts', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/node:lib ${mylib}`);

    updateProjectConfig(mylib, (j) => {
      delete j.targets;
      return j;
    });

    updateFile(
      `libs/${mylib}/package.json`,
      JSON.stringify({
        name: 'mylib1',
        scripts: { 'echo:dev': `echo ECHOED` },
      })
    );

    const { stdout } = await runCLIAsync(
      `echo:dev ${mylib} -- positional --a=123 --no-b`,
      {
        silent: true,
      }
    );
    expect(stdout).toMatch(/ECHOED positional --a=123 --no-b/);
  }, 1000000);
});
