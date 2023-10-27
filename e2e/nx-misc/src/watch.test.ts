import {
  cleanupProject,
  newProject,
  runCLI,
  uniq,
  tmpProjPath,
  getStrippedEnvironmentVariables,
  updateJson,
  isVerboseE2ERun,
  readFile,
} from '@nx/e2e/utils';
import { spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';

let cacheDirectory = mkdtempSync(join(tmpdir(), 'daemon'));
console.log('cache directory', cacheDirectory);

async function writeFileForWatcher(path: string, content: string) {
  const e2ePath = join(tmpProjPath(), path);

  console.log(`writing to: ${e2ePath}`);
  writeFileSync(e2ePath, content);
  await wait(10);
}

describe('Nx Watch', () => {
  let proj1 = uniq('proj1');
  let proj2 = uniq('proj2');
  let proj3 = uniq('proj3');
  beforeAll(() => {
    newProject();
    runCLI(`generate @nx/js:lib ${proj1}`);
    runCLI(`generate @nx/js:lib ${proj2}`);
    runCLI(`generate @nx/js:lib ${proj3}`);
    runCLI('daemon --start', {
      env: {
        NX_DAEMON: 'true',
        NX_NATIVE_LOGGING: 'nx',
        NX_PROJECT_GRAPH_CACHE_DIRECTORY: cacheDirectory,
      },
    });
  });

  afterEach(() => {
    let daemonLog = readFile(join(cacheDirectory, 'd/daemon.log'));
    const testName = expect.getState().currentTestName;
    console.log(`${testName} daemon log: \n${daemonLog}`);
    runCLI('reset');
  });

  afterAll(() => cleanupProject());

  it('should watch for project changes', async () => {
    const getOutput = await runWatch(
      `--projects=${proj1} -- echo \\$NX_PROJECT_NAME`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`, 'content');
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`, 'content');
    await writeFileForWatcher(`newfile2.txt`, 'content');

    expect(await getOutput()).toEqual([proj1]);
  }, 50000);

  it('should watch for all projects and output the project name', async () => {
    const getOutput = await runWatch(`--all -- echo \\$NX_PROJECT_NAME`);
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`, 'content');
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`, 'content');
    await writeFileForWatcher(`newfile2.txt`, 'content');

    let content = await getOutput();
    let results = content.sort();

    expect(results).toEqual([proj1, proj2, proj3]);
  }, 50000);

  it('should watch for all project changes and output the file name changes', async () => {
    const getOutput = await runWatch(`--all -- echo \\$NX_FILE_CHANGES`);
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`, 'content');
    await writeFileForWatcher(`newfile2.txt`, 'content');

    let output = (await getOutput())[0];
    let results = output.split(' ').sort();

    expect(results).toEqual([
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
    ]);
  }, 50000);

  it('should watch for global workspace file changes', async () => {
    const getOutput = await runWatch(
      `--all --includeGlobalWorkspaceFiles -- echo \\$NX_FILE_CHANGES`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`, 'content');
    await writeFileForWatcher(`newfile2.txt`, 'content');

    let output = (await getOutput())[0];
    let results = output.split(' ').sort();

    expect(results).toEqual([
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
      'newfile2.txt',
    ]);
  }, 50000);

  it('should watch selected projects only', async () => {
    const getOutput = await runWatch(
      `--projects=${proj1},${proj3} -- echo \\$NX_PROJECT_NAME`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`, 'content');
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`, 'content');
    await writeFileForWatcher(`newfile2.txt`, 'content');

    let output = await getOutput();
    let results = output.sort();

    expect(results).toEqual([proj1, proj3]);
  }, 50000);

  it('should watch projects including their dependencies', async () => {
    updateJson(`libs/${proj3}/project.json`, (json) => {
      json.implicitDependencies = [proj1];
      return json;
    });

    const getOutput = await runWatch(
      `--projects=${proj3} --includeDependentProjects -- echo \\$NX_PROJECT_NAME`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`, 'content');
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`, 'content');
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`, 'content');
    await writeFileForWatcher(`newfile2.txt`, 'content');

    let output = await getOutput();
    let results = output.sort();

    expect(results).toEqual([proj1, proj3]);
  }, 50000);
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
