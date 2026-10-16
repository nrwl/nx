import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { TempFs } from '../../internal-testing-utils/temp-fs';
import { setWorkspaceRoot, workspaceRoot } from '../../utils/workspace-root';
import {
  evaluateUnderTaskEnv,
  hashTaskDotEnvFiles,
} from './evaluate-under-task-env';

describe('evaluateUnderTaskEnv', () => {
  let tempFs: TempFs;
  let modulePath: string;

  beforeEach(async () => {
    tempFs = new TempFs('evaluate-under-task-env');
    await tempFs.createFiles({
      'module.js': `
        exports.read = (value) => ({
          value,
          pid: process.pid,
          cwd: process.cwd(),
          env: { ...process.env },
          argv: process.argv.slice(2),
          graphCreation: global.NX_GRAPH_CREATION,
          nan: NaN,
        });
        exports.fail = () => {
          throw new Error('cannot read the config');
        };
        exports.exit = () =>
          process.stderr.write('x'.repeat(10000) + 'the reason', () =>
            process.exit(0)
          );
      `,
      'app/.keep': '',
    });
    modulePath = join(tempFs.tempDir, 'module.js');
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('calls the export in a process with exactly the given cwd and env', async () => {
    const cwd = join(tempFs.tempDir, 'app');
    const env = { PATH: process.env.PATH, PORT: '4300' };

    const result = await evaluateUnderTaskEnv<any>(
      modulePath,
      'read',
      [{ port: 4300 }],
      { cwd, env }
    );

    // macOS adds it to every process it starts, the task's included
    const { __CF_USER_TEXT_ENCODING, ...childEnv } = result.env;
    expect({ ...result, env: childEnv }).toEqual({
      value: { port: 4300 },
      pid: expect.any(Number),
      cwd: realpathSync(cwd),
      env,
      argv: [],
      graphCreation: true,
      nan: NaN,
    });
    expect(result.pid).not.toBe(process.pid);
  });

  it.each([
    ['everything matches', [], true, true, true],
    ['the cwd differs', [], false, true, false],
    ['the env differs', [], true, false, false],
    ['it has node options', ['--conditions=development'], true, true, false],
  ])(
    'calls the export in this process only when %s',
    async (_, execArgv: string[], sameCwd, sameEnv, inProcess) => {
      const originalExecArgv = process.execArgv;
      process.execArgv = execArgv;

      try {
        const result = await evaluateUnderTaskEnv<any>(modulePath, 'read', [], {
          cwd: sameCwd ? process.cwd() : tempFs.tempDir,
          env: sameEnv ? { ...process.env } : { ...process.env, PORT: '4300' },
        });

        expect(result.pid === process.pid).toBe(inProcess);
      } finally {
        process.execArgv = originalExecArgv;
      }
    }
  );

  it.each([
    ['the export throws', 'fail', /cannot read the config/],
    [
      'the process exits without a result',
      'exit',
      /exited with code 0 before returning a result\n.*the reason$/,
    ],
  ])('rejects when %s', async (_, exportName, error) => {
    await expect(
      evaluateUnderTaskEnv(modulePath, exportName, [], {
        cwd: tempFs.tempDir,
        env: { PATH: process.env.PATH },
      })
    ).rejects.toThrow(error);
  });
});

describe('hashTaskDotEnvFiles', () => {
  let tempFs: TempFs;
  const originalWorkspaceRoot = workspaceRoot;

  beforeEach(() => {
    tempFs = new TempFs('hash-task-dot-env-files');
    setWorkspaceRoot(tempFs.tempDir);
  });

  afterEach(() => {
    setWorkspaceRoot(originalWorkspaceRoot);
    tempFs.cleanup();
  });

  it.each([
    ['a root file of the task is added', '.env.serve', undefined, true],
    ['a project file of the task changes', 'app/.env', 'PORT=4200', true],
    ['a file of another task is added', 'app/.env.build', undefined, false],
  ])('%s', async (_, file, initialContent, changes) => {
    if (initialContent) {
      await tempFs.createFile(file, initialContent);
    }
    const before = hashTaskDotEnvFiles('app', ['serve']);

    await tempFs.createFile(file, 'PORT=4300');

    expect(hashTaskDotEnvFiles('app', ['serve']) !== before).toBe(changes);
  });
});
