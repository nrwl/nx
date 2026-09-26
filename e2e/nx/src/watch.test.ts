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
  trimDaemonLog,
} from '@nx/e2e-utils';
import { spawn } from 'child_process';
import treeKill from 'tree-kill';
import { join } from 'path';
import { writeFileSync, mkdtempSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

let cacheDirectory = mkdtempSync(join(tmpdir(), 'daemon'));
console.log('cache directory', cacheDirectory);

// getStrippedEnvironmentVariables drops NX_PROJECT_GRAPH_CACHE_DIRECTORY, so every
// nx invocation here must re-add it or it talks to a second daemon in the default
// cache dir — not the one afterEach dumps the log of.
const daemonEnv = {
  NX_DAEMON: 'true',
  NX_PROJECT_GRAPH_CACHE_DIRECTORY: cacheDirectory,
};

// Kept out of daemonEnv: in the daemon this lands in its log file, but the `nx watch`
// client shares stdout with the command output these tests parse.
const daemonStartEnv = { ...daemonEnv, NX_NATIVE_LOGGING: 'nx' };

const OUTPUT_TIMEOUT_MS = 15000;
// Read on past the match: the suite also asserts that unwatched projects did NOT
// run, which a late straggler would otherwise slip past.
const OUTPUT_SETTLE_MS = 500;

/** Every project in `expected` has run the command at least once. */
const ranFor =
  (expected: string[]) =>
  (lines: string[]): boolean =>
    expected.every((e) => lines.includes(e));

/** Unique paths across every NX_FILE_CHANGES batch, sorted. */
function reportedFiles(lines: string[]): string[] {
  return [
    ...new Set(lines.flatMap((line) => line.split(' ')).filter(Boolean)),
  ].sort();
}

// Across batches, not within one: the writes are 10ms apart and the watcher
// coalesces on a 100ms idle window, so a loaded machine splits one burst into
// several batches. Observed on CI as three.
const receivedAll =
  (expected: string[]) =>
  (lines: string[]): boolean => {
    const received = reportedFiles(lines);
    return expected.every((e) => received.includes(e));
  };

// The parsed lines drop every NX-prefixed line, which is where `nx watch`
// reports errors. Keep the raw stream so afterEach can show it.
let lastWatchOutput = '';

let writeSeq = 0;
function uniqueFileContent() {
  return `content-${Date.now()}-${++writeSeq}`;
}

async function writeFileForWatcher(path: string, content?: string) {
  const e2ePath = join(tmpProjPath(), path);

  console.log(`writing to: ${e2ePath}`);
  writeFileSync(e2ePath, content ?? uniqueFileContent());
  await wait(10);
}

async function mkdirForWatcher(path: string) {
  const e2ePath = join(tmpProjPath(), path);

  console.log(`creating directory: ${e2ePath}`);
  mkdirSync(e2ePath, { recursive: true });
  await wait(10);
}

describe('Nx Watch', () => {
  let proj1 = uniq('proj1');
  let proj2 = uniq('proj2');
  let proj3 = uniq('proj3');
  beforeAll(() => {
    newProject({ packages: ['@nx/js'] });
    runCLI(`generate @nx/js:lib libs/${proj1}`, { env: daemonEnv });
    runCLI(`generate @nx/js:lib libs/${proj2}`, { env: daemonEnv });
    runCLI(`generate @nx/js:lib libs/${proj3}`, { env: daemonEnv });
    runCLI('daemon --start', { env: daemonStartEnv });
  });

  afterEach(() => {
    // Dump before reset (which stops the daemon), so CI shows the watcher's
    // batch emissions next to a failing assertion.
    try {
      const daemonLog = readFile(join(cacheDirectory, 'd/daemon.log'));
      const testName = expect.getState().currentTestName;
      if (process.env.NX_E2E_OUTPUT_DAEMON_LOGS === 'true') {
        console.log(`${testName} daemon log: \n${daemonLog}`);
      } else {
        // Trimmed — see trimDaemonLog; the raw log is thousands of lines.
        console.log(
          `${testName} daemon log (trimmed): \n${trimDaemonLog(daemonLog)}`
        );
      }
    } catch (e) {
      console.log(`[watch-debug] failed to read daemon log: ${e}`);
    }
    console.log(`[watch-debug] nx watch output: \n${lastWatchOutput}`);
    runCLI('reset', { env: daemonEnv });
  });

  afterAll(() => cleanupProject());

  it('should watch for project changes', async () => {
    const getOutput = await runWatch(
      `--projects=${proj1} -- echo \\$NX_PROJECT_NAME`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`);
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`);
    await writeFileForWatcher(`newfile2.txt`);

    expect(await getOutput(ranFor([proj1]))).toEqual([proj1]);
  }, 50000);

  it('should watch for all projects and output the project name', async () => {
    const getOutput = await runWatch(`--all -- echo \\$NX_PROJECT_NAME`);
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`);
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`);
    await writeFileForWatcher(`newfile2.txt`);

    let content = await getOutput(ranFor([proj1, proj2, proj3]));
    let results = content.sort();

    expect(results).toEqual([proj1, proj2, proj3]);
  }, 50000);

  it('should watch for all project changes and output the file name changes', async () => {
    const getOutput = await runWatch(`--all -- echo \\$NX_FILE_CHANGES`);
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`);
    await writeFileForWatcher(`newfile2.txt`);

    const expected = [
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
    ];
    const lines = await getOutput(receivedAll(expected));

    expect(reportedFiles(lines)).toEqual([...expected].sort());
  }, 50000);

  it('should watch for global workspace file changes', async () => {
    const getOutput = await runWatch(
      `--all --includeGlobalWorkspaceFiles -- echo \\$NX_FILE_CHANGES`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`);
    await writeFileForWatcher(`newfile2.txt`);

    const expected = [
      `libs/${proj1}/newfile.txt`,
      `libs/${proj1}/newfile2.txt`,
      `libs/${proj2}/newfile.txt`,
      'newfile2.txt',
    ];
    const lines = await getOutput(receivedAll(expected));

    expect(reportedFiles(lines)).toEqual([...expected].sort());
  }, 50000);

  it('should watch selected projects only', async () => {
    const getOutput = await runWatch(
      `--projects=${proj1},${proj3} -- echo \\$NX_PROJECT_NAME`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`);
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`);
    await writeFileForWatcher(`newfile2.txt`);

    let output = await getOutput(ranFor([proj1, proj3]));
    let results = output.sort();

    expect(results).toEqual([proj1, proj3]);
  }, 50000);

  it('should watch projects including their dependencies', async () => {
    updateJson(`libs/${proj3}/project.json`, (json) => {
      json.implicitDependencies = [proj1];
      return json;
    });

    const getOutput = await runWatch(
      `--projects=${proj3} --includeDependencies -- echo \\$NX_PROJECT_NAME`
    );
    await writeFileForWatcher(`libs/${proj1}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj2}/newfile.txt`);
    await writeFileForWatcher(`libs/${proj1}/newfile2.txt`);
    await writeFileForWatcher(`libs/${proj3}/newfile2.txt`);
    await writeFileForWatcher(`newfile2.txt`);

    let output = await getOutput(ranFor([proj1, proj3]));
    let results = output.sort();

    expect(results).toEqual([proj1, proj3]);
  }, 50000);

  it('should detect files created in newly created directories', async () => {
    const getOutput = await runWatch(`--all -- echo \\$NX_FILE_CHANGES`);

    // Create a new subdirectory inside an existing project
    await mkdirForWatcher(`libs/${proj1}/src/newsubdir`);
    // Wait for the watcher to register the new directory
    await wait(2000);

    // Create a file in the newly created directory
    await writeFileForWatcher(
      `libs/${proj1}/src/newsubdir/newfile.ts`,
      'export const x = 1;'
    );

    const expected = [`libs/${proj1}/src/newsubdir/newfile.ts`];
    const lines = await getOutput(receivedAll(expected));

    expect(reportedFiles(lines)).toContain(
      `libs/${proj1}/src/newsubdir/newfile.ts`
    );
  }, 50000);

  it('should reconnect after daemon restart', async () => {
    const getOutput = await runWatchWithReconnect(
      `--projects=${proj1} -- echo \\$NX_PROJECT_NAME`
    );

    // Write file before daemon restart
    await writeFileForWatcher(`libs/${proj1}/before-restart.txt`);
    await wait(1000);

    // Kill the daemon
    runCLI('daemon --stop', { env: daemonEnv });

    // Wait for reconnection to happen (exponential backoff)
    await wait(3000);

    // Write file after daemon restart - watch should reconnect and receive this
    await writeFileForWatcher(`libs/${proj1}/after-restart.txt`);

    const output = await getOutput(ranFor([proj1]));
    expect(output).toContain(proj1);
  }, 60000);
});

type GetOutput = (
  until?: (lines: string[]) => boolean,
  opts?: { settleMs?: number; timeout?: number }
) => Promise<string[]>;

// Waits for `until` rather than a fixed window, so a slow-but-correct watcher
// passes while a silent one still fails.
function createGetOutput(
  p: ReturnType<typeof spawn>,
  readStdout: () => string,
  readAll: () => string = readStdout
) {
  // Registered while handling the process's own stdout, so it cannot have
  // closed yet. Awaiting a promise created here -- rather than attaching a
  // listener after the kill -- also covers the process exiting on its own,
  // where a listener added after 'close' already fired would hang the test.
  let exited = false;
  const closed = new Promise<void>((res) =>
    p.on('close', () => {
      exited = true;
      res();
    })
  );

  const lines = () =>
    readStdout()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.includes('NX'));

  const getOutput: GetOutput = async (
    until = (l) => l.length > 0,
    { settleMs = OUTPUT_SETTLE_MS, timeout = OUTPUT_TIMEOUT_MS } = {}
  ) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline && !exited && !until(lines())) {
      await wait(50);
    }

    // Sampled before the kill below, which would otherwise set `exited` too and
    // make every timeout look like the process had died on its own.
    const exitedOnItsOwn = exited;
    if (!exited) {
      await wait(settleMs);
      treeKill(p.pid);
    }
    await closed;

    if (exitedOnItsOwn && !until(lines())) {
      // `nx watch` exits on a fatal daemon error. Reporting that beats letting
      // the caller assert on an empty array and show `Received: []`.
      throw new Error(
        `nx watch exited before producing the expected output:\n${readAll()}`
      );
    }
    return lines();
  };

  return getOutput;
}

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
  return new Promise<GetOutput>((resolve) => {
    const p = spawn(runCommand, {
      cwd: tmpProjPath(),
      env: {
        CI: 'true',
        ...getStrippedEnvironmentVariables(),
        FORCE_COLOR: 'false',
        ...daemonEnv,
      },
      shell: true,
      stdio: 'pipe',
    });

    let output = '';
    let all = '';
    lastWatchOutput = '';
    let resolved = false;
    p.stdout?.on('data', (data) => {
      output += data;
      all += data;
      lastWatchOutput = all;
      const s = data.toString().trim();
      isVerboseE2ERun() && console.log(s);
      if (s.includes('watch process waiting') && !resolved) {
        resolved = true;
        resolve(
          createGetOutput(
            p,
            () => output,
            () => all
          )
        );
      }
    });

    p.stderr?.on('data', (data) => {
      all += data;
      lastWatchOutput = all;
      isVerboseE2ERun() && console.log('stderr:', data.toString().trim());
    });
  });
}

async function runWatchWithReconnect(command: string) {
  const runCommand = `npx -c 'nx watch --verbose ${command}'`;
  isVerboseE2ERun() && console.log(runCommand);
  return new Promise<GetOutput>((resolve) => {
    const p = spawn(runCommand, {
      cwd: tmpProjPath(),
      env: {
        CI: 'true',
        ...getStrippedEnvironmentVariables(),
        FORCE_COLOR: 'false',
        ...daemonEnv,
      },
      shell: true,
      stdio: 'pipe',
    });

    let output = '';
    let all = '';
    lastWatchOutput = '';
    let resolved = false;
    p.stdout?.on('data', (data) => {
      output += data;
      all += data;
      lastWatchOutput = all;
      const s = data.toString().trim();
      isVerboseE2ERun() && console.log(s);
      // Resolve once we see the watch is ready, but don't kill the process yet
      if (s.includes('watch process waiting') && !resolved) {
        resolved = true;
        resolve(
          createGetOutput(
            p,
            () => output,
            () => all
          )
        );
      }
    });

    p.stderr?.on('data', (data) => {
      all += data;
      lastWatchOutput = all;
      const s = data.toString().trim();
      isVerboseE2ERun() && console.log('stderr:', s);
    });
  });
}
