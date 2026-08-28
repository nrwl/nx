import { existsSync, readFileSync } from 'fs';
import {
  cleanupProject,
  listFiles,
  newProject,
  readFile,
  runCLI,
  uniq,
  updateFile,
} from '@nx/e2e-utils';

const TERMINAL_OUTPUTS_DIR = '.nx/cache/terminalOutputs';

describe('terminal outputs on disk', () => {
  beforeAll(() => newProject({ packages: [] }));

  afterAll(() => cleanupProject());

  /**
   * Every task that reaches a terminal state has to leave its output at
   * `<cacheDir>/terminalOutputs/<hash>`, so the file is found by content
   * rather than by recomputing the task's hash.
   */
  function terminalOutputContains(marker: string): boolean {
    return listFiles(TERMINAL_OUTPUTS_DIR).some((file) =>
      readFile(`${TERMINAL_OUTPUTS_DIR}/${file}`).includes(marker)
    );
  }

  function createRunCommandsProject(
    lib: string,
    marker: string,
    cache: boolean
  ) {
    updateFile(
      `libs/${lib}/project.json`,
      JSON.stringify({
        name: lib,
        targets: {
          echo: {
            executor: 'nx:run-commands',
            cache,
            options: { command: `node -e "console.log('${marker}')"` },
          },
        },
      })
    );
  }

  it('should write terminal output for a cache:false task with --output-style=stream', () => {
    const lib = uniq('streamed');
    const marker = `streamed-marker-${lib}`;
    createRunCommandsProject(lib, marker, false);

    const results = runCLI(`echo ${lib} --output-style=stream`);

    expect(results).toContain(marker);
    expect(terminalOutputContains(marker)).toBe(true);
  }, 120000);

  it('should write terminal output for a cache:false task in batch mode', () => {
    const plugin = uniq('batch-plugin');
    const lib = uniq('batched');
    const marker = `batched-marker-${lib}`;

    // A minimal plugin whose executor supports batching, dropped straight into
    // node_modules so it resolves like any installed one. Its batch
    // implementation hands each task's output back over IPC and never touches
    // disk — exactly the path that used to leave no file behind.
    const pluginRoot = `node_modules/${plugin}`;
    updateFile(
      `${pluginRoot}/package.json`,
      JSON.stringify({
        name: plugin,
        version: '0.0.1',
        executors: './executors.json',
      })
    );
    updateFile(
      `${pluginRoot}/executors.json`,
      JSON.stringify({
        executors: {
          echo: {
            implementation: './impl',
            batchImplementation: './batch-impl',
            schema: './schema.json',
          },
        },
      })
    );
    updateFile(
      `${pluginRoot}/schema.json`,
      JSON.stringify({
        $schema: 'http://json-schema.org/schema',
        type: 'object',
        properties: { text: { type: 'string' } },
      })
    );
    updateFile(
      `${pluginRoot}/impl.js`,
      `module.exports = {
        default: async (options) => {
          console.log(options.text);
          return { success: true };
        },
      };`
    );
    updateFile(
      `${pluginRoot}/batch-impl.js`,
      `module.exports = {
        default: async (taskGraph, inputs) => {
          const results = {};
          for (const taskId of Object.keys(taskGraph.tasks)) {
            results[taskId] = {
              success: true,
              terminalOutput: inputs[taskId].text,
            };
          }
          return results;
        },
      };`
    );

    updateFile(
      `libs/${lib}/project.json`,
      JSON.stringify({
        name: lib,
        targets: {
          echo: {
            executor: `${plugin}:echo`,
            cache: false,
            options: { text: marker },
          },
        },
      })
    );

    runCLI(`echo ${lib}`, { env: { NX_BATCH_MODE: 'true' } });

    expect(terminalOutputContains(marker)).toBe(true);
  }, 120000);

  it('should not replay a task whose output was written without artifacts', () => {
    const lib = uniq('skipcache');
    const marker = `skipcache-marker-${lib}`;
    createRunCommandsProject(lib, marker, true);

    // --skip-nx-cache leaves a terminal output file, and a record of it so the
    // GC can collect it, but writes no cache entry.
    const skipped = runCLI(`echo ${lib} --skip-nx-cache`);
    expect(skipped).not.toContain('read the output from the cache');
    expect(terminalOutputContains(marker)).toBe(true);

    // That record must never be served as a hit — there are no outputs behind
    // it, so replaying it would restore nothing while reporting success.
    const firstRealRun = runCLI(`echo ${lib}`);
    expect(firstRealRun).not.toContain('read the output from the cache');

    // ...and the real entry it just wrote supersedes the record.
    const replay = runCLI(`echo ${lib}`);
    expect(replay).toContain('read the output from the cache');
  }, 120000);

  describe('--output-style=summary', () => {
    function createFailingProject(lib: string, marker: string) {
      updateFile(
        `libs/${lib}/project.json`,
        JSON.stringify({
          name: lib,
          targets: {
            echo: {
              executor: 'nx:run-commands',
              cache: false,
              options: {
                command: `node -e "console.log('${marker}'); process.exit(3)"`,
              },
            },
          },
        })
      );
    }

    function nonEmptyLines(out: string): string[] {
      return out.split('\n').filter((l) => l.trim().length > 0);
    }

    it('should collapse a passing run to a handful of lines', () => {
      const lib = uniq('summary-pass');
      const marker = `summary-pass-marker-${lib}`;
      createRunCommandsProject(lib, marker, false);

      const results = runCLI(`echo ${lib} --output-style=summary`);

      // The task's own output is on disk, not in the run's output.
      expect(results).not.toContain(marker);
      expect(results).toContain('succeeded');
      expect(nonEmptyLines(results).length).toBeLessThanOrEqual(10);
    }, 120000);

    it('should name a failing task and point at its log on disk', () => {
      const lib = uniq('summary-fail');
      const marker = `summary-fail-marker-${lib}`;
      createFailingProject(lib, marker);

      const results = runCLI(`echo ${lib} --output-style=summary`, {
        silenceError: true,
        redirectStderr: true,
      });

      expect(results).toContain('1 failed');
      expect(results).toContain(`nx run ${lib}:echo`);
      // No exit code is printed. `completeTasks` rebuilds `TaskResult.code`
      // from the status rather than carrying the code the process returned, so
      // every failure reaches a life cycle as 1 - this task exits 3 and would
      // have rendered `(exit 1)`. Rather than print a number that is always 1
      // to a reader whose job is to machine-read the line, the style prints
      // none. Carrying the real code through `TaskResult` would change what
      // task history and Nx Cloud record, which is its own change.
      expect(results).not.toContain('(exit');
      // Bounded regardless of how much the task logged.
      expect(nonEmptyLines(results).length).toBeLessThanOrEqual(30);

      // The path it prints has to be real, and hold the output it stands in for.
      const logPath = results.match(/full log: (\S+)/)?.[1];
      expect(logPath).toBeDefined();
      expect(existsSync(logPath)).toBe(true);
      expect(readFileSync(logPath, 'utf-8')).toContain(marker);
    }, 120000);

    it('should be the default when nx is driven by an AI agent', () => {
      const lib = uniq('summary-agent');
      const marker = `summary-agent-marker-${lib}`;
      createRunCommandsProject(lib, marker, false);

      const results = runCLI(`echo ${lib}`, { env: { CLAUDECODE: '1' } });

      expect(results).not.toContain(marker);
      expect(results).toContain('succeeded');
      expect(nonEmptyLines(results).length).toBeLessThanOrEqual(10);
    }, 120000);

    it('should let an explicit output style beat the AI agent default', () => {
      const lib = uniq('summary-explicit');
      const marker = `summary-explicit-marker-${lib}`;
      createRunCommandsProject(lib, marker, false);

      const results = runCLI(`echo ${lib} --output-style=static`, {
        env: { CLAUDECODE: '1' },
      });

      // static prints every task in full, agent or not.
      expect(results).toContain(marker);
    }, 120000);
  });

  it('should keep the cached path intact so a replay still reads its output', () => {
    const lib = uniq('cached');
    const marker = `cached-marker-${lib}`;
    createRunCommandsProject(lib, marker, true);

    const firstRun = runCLI(`echo ${lib}`);
    expect(firstRun).not.toContain('read the output from the cache');
    expect(terminalOutputContains(marker)).toBe(true);

    const replay = runCLI(`echo ${lib}`);
    expect(replay).toContain('read the output from the cache');
    // The replay reads this very file, so it must still be there afterwards.
    expect(terminalOutputContains(marker)).toBe(true);
  }, 120000);
});
