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
