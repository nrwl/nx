import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
  getPackageManagerCommand,
  tmpProjPath,
  getStrippedEnvironmentVariables,
  updateJson,
} from '@nrwl/e2e/utils';
import { exec, spawn } from 'child_process';

describe('Nx Commands', () => {
  let proj1 = uniq('proj1');
  let proj2 = uniq('proj2');
  let proj3 = uniq('proj3');
  beforeAll(() => {
    newProject();
    runCLI(`generate @nrwl/workspace:lib ${proj1}`);
    runCLI(`generate @nrwl/workspace:lib ${proj2}`);
    runCLI(`generate @nrwl/workspace:lib ${proj3}`);
  });

  afterAll(() => cleanupProject());

  it('should watch for project changes', async () => {
    const getOutput = await runWatch(`${proj1} -- "echo &1"`);
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([proj1]);
  });

  it('should watch for all projects and output the project name', async () => {
    const getOutput = await runWatch(`--all -- "echo &1"`);
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([proj1, proj2, proj3]);
  });

  it('should watch for all project changes and output the file name changes', async () => {
    const getOutput = await runWatch(`--all -- "echo &2"`);
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
    ]);
  });

  it('should watch for global workspace file changes', async () => {
    const getOutput = await runWatch(
      `--all --includeGlobalWorkspaceFiles -- "echo &2"`
    );
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
      'newfile2.txt',
    ]);
  });

  it('should watch selected projects only', async () => {
    const getOutput = await runWatch(
      `--projects=${proj1},${proj3} -- "echo &1"`
    );
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([proj1, proj3]);
  });

  it('should watch projects including their dependencies', async () => {
    updateJson(`libs/${proj3}/project.json`, (json) => {
      json.implicitDependencies = [proj1];
      return json;
    });

    const getOutput = await runWatch(
      `${proj3} --includeDependentProjects -- "echo &1"`
    );
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([proj3, proj1]);
  });
});

async function wait(timeout = 200) {
  return new Promise<void>((res) => {
    setTimeout(() => {
      res();
    }, timeout);
  });
}

async function runWatch(command: string) {
  const output = [];
  const pm = getPackageManagerCommand();
  return new Promise<(timeout?: number) => Promise<string[]>>((resolve) => {
    const p = spawn(`${pm.runNx} watch --verbose ${command}`, {
      cwd: tmpProjPath(),
      env: {
        CI: 'true',
        ...getStrippedEnvironmentVariables(),
        FORCE_COLOR: 'false',
      },

      shell: true,
      stdio: 'pipe',
    });

    p.stdout?.on('data', (data) => {
      const s = data.toString().trim();
      if (s.includes('watch process waiting')) {
        resolve(async (timeout = 6000) => {
          await wait(timeout);
          p.kill();
          return output;
        });
      } else {
        if (s.length == 0 || s.includes('NX')) {
          return;
        }
        output.push(s);
      }
    });
  });
}
