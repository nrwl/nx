import {
  cleanupProject,
  createFile,
  newProject,
  runCLI,
  uniq,
  tmpProjPath,
  getStrippedEnvironmentVariables,
  updateJson,
  isVerboseE2ERun,
} from '@nx/e2e/utils';
import { spawn } from 'child_process';

describe('Nx Commands', () => {
  let proj1 = uniq('proj1');
  let proj2 = uniq('proj2');
  let proj3 = uniq('proj3');
  beforeAll(() => {
    newProject({ packageManager: 'npm' });
    runCLI(`generate @nx/js:lib ${proj1}`);
    runCLI(`generate @nx/js:lib ${proj2}`);
    runCLI(`generate @nx/js:lib ${proj3}`);
  });

  afterAll(() => cleanupProject());

  it('should watch for project changes', async () => {
    const getOutput = await runWatch(
      `--projects=${proj1} -- echo \\$NX_PROJECT_NAME`
    );
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([proj1]);
  });

  it('should watch for all projects and output the project name', async () => {
    const getOutput = await runWatch(`--all -- echo \\$NX_PROJECT_NAME`);
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    let content = await getOutput();
    let results = content.sort();

    expect(results).toEqual([proj1, proj2, proj3]);
  });

  it('should watch for all project changes and output the file name changes', async () => {
    const getOutput = await runWatch(`--all -- echo \\$NX_FILE_CHANGES`);
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    let output = (await getOutput())[0];
    let results = output.split(' ').sort();

    expect(results).toEqual([
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
    ]);
  });

  it('should watch for global workspace file changes', async () => {
    const getOutput = await runWatch(
      `--all --includeGlobalWorkspaceFiles -- echo \\$NX_FILE_CHANGES`
    );
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    let output = (await getOutput())[0];
    let results = output.split(' ').sort();

    expect(results).toEqual([
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
      'newfile2.txt',
    ]);
  });

  it('should watch selected projects only', async () => {
    const getOutput = await runWatch(
      `--projects=${proj1},${proj3} -- echo \\$NX_PROJECT_NAME`
    );
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    let output = await getOutput();
    let results = output.sort();

    expect(results).toEqual([proj1, proj3]);
  });

  it('should watch projects including their dependencies', async () => {
    updateJson(`libs/${proj3}/project.json`, (json) => {
      json.implicitDependencies = [proj1];
      return json;
    });

    const getOutput = await runWatch(
      `--projects=${proj3} --includeDependentProjects -- echo \\$NX_PROJECT_NAME`
    );
    createFile(`libs/${proj1}/newfile.txt`, 'content');
    createFile(`libs/${proj2}/newfile.txt`, 'content');
    createFile(`libs/${proj1}/newfile2.txt`, 'content');
    createFile(`libs/${proj3}/newfile2.txt`, 'content');
    createFile(`newfile2.txt`, 'content');

    let output = await getOutput();
    let results = output.sort();

    expect(results).toEqual([proj1, proj3]);
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
  const runCommand = `npx -c 'nx watch --verbose ${command}'`;
  isVerboseE2ERun() && console.log(runCommand);
  return new Promise<(timeout?: number) => Promise<string[]>>((resolve) => {
    const p = spawn(runCommand, {
      cwd: tmpProjPath(),
      env: {
        CI: 'true',
        ...getStrippedEnvironmentVariables(),
        FORCE_COLOR: 'false',
      },
      shell: true,
      stdio: 'pipe',
    });

    let output = '';
    p.stdout?.on('data', (data) => {
      output += data;
      const s = data.toString().trim();
      isVerboseE2ERun() && console.log(s);
      if (s.includes('watch process waiting')) {
        resolve(async (timeout = 6000) => {
          await wait(timeout);
          p.kill();
          return output
            .split('\n')
            .filter((line) => line.length > 0 && !line.includes('NX'));
        });
      }
    });
  });
}
