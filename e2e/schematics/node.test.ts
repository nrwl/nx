import {
  newProject,
  runCLI,
  copyMissingPackages,
  exists,
  runCLIAsync,
  updateFile,
  readJson,
  ensureProject,
  uniq
} from '../utils';
import { fork, spawn, execSync } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import * as treeKill from 'tree-kill';

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

describe('Node Applications', () => {
  xit('should be able to generate an express application', async done => {
    ensureProject();
    const nodeapp = uniq('nodeapp');
    runCLI(`generate @nrwl/express:app ${nodeapp}`);

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
    // const jestResult = await runCLIAsync(`test ${nodeapp}`);
    // expect(jestResult.stderr).toContain('Test Suites: 1 passed, 1 total');

    await runCLIAsync(`build ${nodeapp}`);

    expect(exists(`./tmp/proj/dist/apps/${nodeapp}/main.js`)).toBeTruthy();
    expect(
      exists(`./tmp/proj/dist/apps/${nodeapp}/assets/file.txt`)
    ).toBeTruthy();
    expect(exists(`./tmp/proj/dist/apps/${nodeapp}/main.js.map`)).toBeTruthy();

    const server = fork(
      path.join(
        __dirname,
        '../../../tmp/proj',
        `./dist/apps/${nodeapp}/main.js`
      ),
      [],
      {
        cwd: './tmp/proj',
        silent: true
      }
    );
    expect(server).toBeTruthy();

    await new Promise(resolve => {
      server.stdout.once('data', async data => {
        expect(data.toString()).toContain('Listening at http://localhost:3333');
        const result = await getData();

        expect(result.message).toEqual(`Welcome to ${nodeapp}!`);
        treeKill(server.pid, 'SIGTERM', err => {
          expect(err).toBeFalsy();
          resolve();
        });
      });
    });
    const config = readJson('angular.json');
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
    updateFile('angular.json', JSON.stringify(config));

    const process = spawn(
      'node',
      ['./node_modules/.bin/ng', 'serve', nodeapp],
      {
        cwd: './tmp/proj'
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
        expect(collectedOutput.startsWith('DONE')).toBeTruthy();
        expect(err).toBeFalsy();
        done();
      });
    });
  }, 30000);

  it('should be able to generate a nest application', async done => {
    ensureProject();
    const nestapp = uniq('nestapp');
    runCLI(`generate @nrwl/nest:app ${nestapp}`);

    updateFile(`apps/${nestapp}/src/assets/file.txt`, ``);
    // const jestResult = await runCLIAsync(`test ${nestapp}`);
    // expect(jestResult.stderr).toContain('Test Suites: 2 passed, 2 total');

    await runCLIAsync(`build ${nestapp}`);

    expect(exists(`./tmp/proj/dist/apps/${nestapp}/main.js`)).toBeTruthy();
    expect(
      exists(`./tmp/proj/dist/apps/${nestapp}/assets/file.txt`)
    ).toBeTruthy();
    expect(exists(`./tmp/proj/dist/apps/${nestapp}/main.js.map`)).toBeTruthy();

    const server = fork(
      path.join(
        __dirname,
        '../../../tmp/proj',
        `./dist/apps/${nestapp}/main.js`
      ),
      [],
      {
        cwd: './tmp/proj',
        silent: true
      }
    );
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
      ['./node_modules/.bin/ng', 'serve', nestapp],
      {
        cwd: './tmp/proj'
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
  }, 30000);

  it('should be able to generate an empty application', async () => {
    ensureProject();
    const nodeapp = uniq('nodeapp');

    runCLI(`generate @nrwl/node:app ${nodeapp}`);
    updateFile(`apps/${nodeapp}/src/main.ts`, `console.log('Hello World!');`);
    await runCLIAsync(`build ${nodeapp}`);
    expect(exists(`./tmp/proj/dist/apps/${nodeapp}/main.js`)).toBeTruthy();
    const result = execSync(`node dist/apps/${nodeapp}/main.js`, {
      cwd: './tmp/proj'
    }).toString();
    expect(result).toContain('Hello World!');
  }, 30000);
});
