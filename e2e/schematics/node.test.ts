import {
  newProject,
  runCLI,
  copyMissingPackages,
  exists,
  runCLIAsync,
  updateFile,
  readJson
} from '../utils';
import { fork, spawn, execSync } from 'child_process';
import * as http from 'http';
import * as path from 'path';
import * as treeKill from 'tree-kill';

function getData() {
  return new Promise(resolve => {
    http.get('http://localhost:3333/api', res => {
      expect(res.statusCode).toEqual(200);
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.once('end', () => {
        resolve(data);
      });
    });
  });
}

describe('Node Applications', () => {
  beforeAll(() => {
    newProject();
    runCLI('generate jest');
    copyMissingPackages();
  });

  it('should be able to generate a node application', async done => {
    runCLI('generate node-app node-app1');
    copyMissingPackages();

    updateFile(
      'apps/node-app1/src/app/test.spec.ts',
      `
          describe('test', () => {
            it('should work', () => {
              expect(true).toEqual(true);
            })
          })
        `
    );

    updateFile('apps/node-app1/src/assets/file.txt', ``);
    const jestResult = await runCLIAsync('test node-app1');
    expect(jestResult.stderr).toContain('Test Suites: 1 passed, 1 total');

    await runCLIAsync('build node-app1');

    expect(exists('./tmp/proj/dist/apps/node-app1/main.js')).toBeTruthy();
    expect(
      exists('./tmp/proj/dist/apps/node-app1/assets/file.txt')
    ).toBeTruthy();
    expect(exists('./tmp/proj/dist/apps/node-app1/main.js.map')).toBeTruthy();

    const server = fork(
      path.join(
        __dirname,
        '../../../tmp/proj',
        `./dist/apps/node-app1/main.js`
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

        expect(result).toEqual('Welcome to node-app1!');
        treeKill(server.pid, 'SIGTERM', err => {
          expect(err).toBeFalsy();
          resolve();
        });
      });
    });

    const config = readJson('angular.json');
    config.projects['node-app1'].architect.waitAndPrint = {
      builder: '@nrwl/builders:run-commands',
      options: {
        commands: [
          {
            command: 'sleep 1 && echo DONE'
          }
        ],
        readyWhen: 'DONE'
      }
    };
    config.projects['node-app1'].architect.serve.options.waitUntilTargets = [
      'node-app1:waitAndPrint'
    ];
    updateFile('angular.json', JSON.stringify(config));

    const process = spawn(
      'node',
      ['./node_modules/.bin/ng', 'serve', 'node-app1'],
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
      expect(result).toEqual('Welcome to node-app1!');
      treeKill(process.pid, 'SIGTERM', err => {
        expect(collectedOutput.startsWith('DONE')).toBeTruthy();
        expect(err).toBeFalsy();
        done();
      });
    });
  }, 30000);

  it('should be able to generate a nest application', async done => {
    runCLI('generate node-app nest-app --framework nestjs');
    copyMissingPackages();

    updateFile('apps/nest-app/src/assets/file.txt', ``);
    const jestResult = await runCLIAsync('test nest-app');
    expect(jestResult.stderr).toContain('Test Suites: 2 passed, 2 total');

    await runCLIAsync('build nest-app');

    expect(exists('./tmp/proj/dist/apps/nest-app/main.js')).toBeTruthy();
    expect(
      exists('./tmp/proj/dist/apps/nest-app/assets/file.txt')
    ).toBeTruthy();
    expect(exists('./tmp/proj/dist/apps/nest-app/main.js.map')).toBeTruthy();

    const server = fork(
      path.join(__dirname, '../../../tmp/proj', `./dist/apps/nest-app/main.js`),
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

          expect(result).toEqual('Welcome to nest-app!');
          treeKill(server.pid, 'SIGTERM', err => {
            expect(err).toBeFalsy();
            resolve();
          });
        }
      });
    });

    const process = spawn(
      'node',
      ['./node_modules/.bin/ng', 'serve', 'nest-app'],
      {
        cwd: './tmp/proj'
      }
    );

    process.stdout.on('data', async (data: Buffer) => {
      if (!data.toString().includes('Listening at http://localhost:3333')) {
        return;
      }
      const result = await getData();
      expect(result).toEqual('Welcome to nest-app!');
      treeKill(process.pid, 'SIGTERM', err => {
        expect(err).toBeFalsy();
        done();
      });
    });
  }, 30000);

  it('should be able to generate an empty application', async () => {
    runCLI('generate node-app node-app2 --framework none');
    updateFile('apps/node-app2/src/main.ts', `console.log('Hello World!');`);
    await runCLIAsync('build node-app2');
    expect(exists('./tmp/proj/dist/apps/node-app2/main.js')).toBeTruthy();
    const result = execSync('node dist/apps/node-app2/main.js', {
      cwd: './tmp/proj'
    }).toString();
    expect(result).toContain('Hello World!');
  }, 30000);
});
