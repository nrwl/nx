import { execSync, fork, spawn } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import * as treeKill from 'tree-kill';
import * as ts from 'typescript';
import {
  ensureProject,
  readJson,
  runCLI,
  runCLIAsync,
  uniq,
  updateFile,
  forEachCli,
  checkFilesExist,
  tmpProjPath,
  workspaceConfigName,
  cleanup,
  runNew,
  runNgAdd,
  copyMissingPackages,
  setMaxWorkers
} from './utils';

function getData(): Promise<any> {
  return new Promise(resolve => {
    http.get('http://localhost:3333/api', res => {
      expect(res.statusCode).toEqual(200);
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.once('end', () => {
        resolve(JSON.parse(data));
      });
    });
  });
}

forEachCli(currentCLIName => {
  const linter = currentCLIName === 'angular' ? 'tslint' : 'eslint';

  describe('Node Applications', () => {
    it('should be able to generate an express application', async done => {
      ensureProject();
      const nodeapp = uniq('nodeapp');

      runCLI(`generate @nrwl/express:app ${nodeapp} --linter=${linter}`);
      const lintResults = runCLI(`lint ${nodeapp}`);
      expect(lintResults).toContain('All files pass linting.');

      updateFile(
        `apps/${nodeapp}/src/app/test.spec.ts`,
        `
          describe('test', () => {
            it('should work', () => {
              expect(true).toEqual(true);
            })
          })
        `
      );

      updateFile(`apps/${nodeapp}/src/assets/file.txt`, ``);
      const jestResult = await runCLIAsync(`test ${nodeapp}`);
      expect(jestResult.stderr).toContain('Test Suites: 1 passed, 1 total');
      await runCLIAsync(`build ${nodeapp}`);

      checkFilesExist(
        `dist/apps/${nodeapp}/main.js`,
        `dist/apps/${nodeapp}/assets/file.txt`,
        `dist/apps/${nodeapp}/main.js.map`
      );

      const server = fork(`./dist/apps/${nodeapp}/main.js`, [], {
        cwd: tmpProjPath(),
        silent: true
      });
      expect(server).toBeTruthy();
      await new Promise(resolve => {
        server.stdout.once('data', async data => {
          expect(data.toString()).toContain(
            'Listening at http://localhost:3333'
          );
          const result = await getData();

          expect(result.message).toEqual(`Welcome to ${nodeapp}!`);
          treeKill(server.pid, 'SIGTERM', err => {
            expect(err).toBeFalsy();
            resolve();
          });
        });
      });
      const config = readJson(workspaceConfigName());
      config.projects[nodeapp].architect.waitAndPrint = {
        builder: '@nrwl/workspace:run-commands',
        options: {
          commands: [
            {
              command: 'sleep 1 && echo DONE'
            }
          ],
          readyWhen: 'DONE'
        }
      };

      config.projects[nodeapp].architect.serve.options.waitUntilTargets = [
        `${nodeapp}:waitAndPrint`
      ];
      updateFile(workspaceConfigName(), JSON.stringify(config));
      const process = spawn(
        'node',
        ['./node_modules/.bin/nx', 'serve', nodeapp],
        {
          cwd: tmpProjPath()
        }
      );
      let collectedOutput = '';
      process.stdout.on('data', async (data: Buffer) => {
        collectedOutput += data.toString();
        if (!data.toString().includes('Listening at http://localhost:3333')) {
          return;
        }

        const result = await getData();
        expect(result.message).toEqual(`Welcome to ${nodeapp}!`);
        treeKill(process.pid, 'SIGTERM', err => {
          expect(collectedOutput.indexOf('DONE') > -1).toBeTruthy();
          expect(err).toBeFalsy();
          done();
        });
      });
    }, 60000);

    it('should have correct ts options for nest application', async () => {
      if (currentCLIName === 'angular') {
        // Usually the tests use ensureProject() to setup the test workspace. But it will trigger
        // the nx workspace schematic which creates a tsconfig file containing the parameters
        // required by nest.
        // However, when creating an Angular workspace and adding the workspace capability (as
        // described in the docs) the tsconfig file could miss required options if Angular removes
        // them from their config files as happened with emitDecoratorMetadata.
        cleanup();
        runNew('', false, false);
        runNgAdd('add @nrwl/workspace --npmScope projscope --skip-install');
        copyMissingPackages();
      } else {
        ensureProject();
      }

      const nestapp = uniq('nestapp');
      runCLI(`generate @nrwl/nest:app ${nestapp} --linter=${linter}`);
      const configPath = tmpProjPath(`apps/${nestapp}/tsconfig.app.json`);
      const json = ts.readConfigFile(configPath, ts.sys.readFile);
      const config = ts.parseJsonConfigFileContent(
        json.config,
        ts.sys,
        path.dirname(configPath)
      ); // respects "extends" inside tsconfigs

      expect(config.options.emitDecoratorMetadata).toEqual(true); // required by nest to function properly
    }, 60000);

    it('should be able to generate a nest application', async done => {
      ensureProject();
      const nestapp = uniq('nestapp');
      runCLI(`generate @nrwl/nest:app ${nestapp} --linter=${linter}`);

      setMaxWorkers(nestapp);

      const lintResults = runCLI(`lint ${nestapp}`);
      expect(lintResults).toContain('All files pass linting.');

      updateFile(`apps/${nestapp}/src/assets/file.txt`, ``);
      const jestResult = await runCLIAsync(`test ${nestapp}`);
      expect(jestResult.stderr).toContain('Test Suites: 2 passed, 2 total');

      await runCLIAsync(`build ${nestapp}`);

      checkFilesExist(
        `dist/apps/${nestapp}/main.js`,
        `dist/apps/${nestapp}/assets/file.txt`,
        `dist/apps/${nestapp}/main.js.map`
      );

      const server = fork(`./dist/apps/${nestapp}/main.js`, [], {
        cwd: tmpProjPath(),
        silent: true
      });
      expect(server).toBeTruthy();

      await new Promise(resolve => {
        server.stdout.on('data', async data => {
          const message = data.toString();
          if (message.includes('Listening at http://localhost:3333')) {
            const result = await getData();

            expect(result.message).toEqual(`Welcome to ${nestapp}!`);
            treeKill(server.pid, 'SIGTERM', err => {
              expect(err).toBeFalsy();
              resolve();
            });
          }
        });
      });

      const process = spawn(
        'node',
        ['./node_modules/@nrwl/cli/bin/nx', 'serve', nestapp],
        {
          cwd: tmpProjPath()
        }
      );

      process.stdout.on('data', async (data: Buffer) => {
        if (!data.toString().includes('Listening at http://localhost:3333')) {
          return;
        }
        const result = await getData();
        expect(result.message).toEqual(`Welcome to ${nestapp}!`);
        treeKill(process.pid, 'SIGTERM', err => {
          expect(err).toBeFalsy();
          done();
        });
      });
    }, 60000);

    it('should be able to generate an empty application', async () => {
      ensureProject();
      const nodeapp = uniq('nodeapp');

      runCLI(`generate @nrwl/node:app ${nodeapp} --linter=${linter}`);

      setMaxWorkers(nodeapp);

      const lintResults = runCLI(`lint ${nodeapp}`);
      expect(lintResults).toContain('All files pass linting.');

      updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
      await runCLIAsync(`build ${nodeapp}`);

      checkFilesExist(`dist/apps/${nodeapp}/main.js`);
      const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
        cwd: tmpProjPath()
      }).toString();
      expect(result).toContain('Hello World!');
    }, 60000);
  });
});
