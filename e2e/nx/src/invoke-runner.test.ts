import {
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('Invoke Runner', () => {
  let proj: string;
  beforeAll(() => (proj = newProject({ packages: ['@nx/js'] })));
  afterAll(() => cleanupProject());

  // Exercises `runDiscreteTasks` / `runContinuousTasks` — the programmatic
  // task-execution API consumed by Nx Cloud agents. Mirrors the way the
  // distributed agent invokes them (see ocean's execute-tasks-v3.ts).
  it('should invoke discrete and continuous tasks imperatively', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/js:lib libs/${mylib}`);
    updateJson(join('libs', mylib, 'project.json'), (c) => {
      c.targets['prebuild'] = { command: 'echo prebuild' };
      c.targets['build'] = { command: 'echo build' };
      c.targets['serve'] = {
        continuous: true,
        command: `node -e "console.log('SERVE_STARTED'); setInterval(() => {}, 100000)"`,
      };
      return c;
    });

    updateFile(
      'runner.js',
      `
      const {
        runDiscreteTasks,
        runContinuousTasks,
      } = require('nx/src/tasks-runner/init-tasks-runner');
      const {
        createProjectGraphAsync,
      } = require('nx/src/project-graph/project-graph');
      const { readNxJson } = require('nx/src/config/nx-json');

      function makeTaskGraph(tasks) {
        return {
          roots: tasks.map((t) => t.id),
          tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
          dependencies: Object.fromEntries(tasks.map((t) => [t.id, []])),
          continuousDependencies: Object.fromEntries(
            tasks.map((t) => [t.id, []])
          ),
        };
      }

      async function main() {
        const projectGraph = await createProjectGraphAsync({ exitOnError: true });
        const nxJson = readNxJson();
        const lifeCycle = {};

        const discrete = ['prebuild', 'build'].map((target) => ({
          id: '${mylib}:' + target,
          target: { project: '${mylib}', target },
          overrides: { __overrides_unparsed__: '' },
          outputs: [],
          parallelism: true,
          continuous: false,
        }));
        const handles = await runDiscreteTasks(
          discrete,
          projectGraph,
          makeTaskGraph(discrete),
          nxJson,
          lifeCycle
        );
        const results = (await Promise.all(handles)).flat();
        for (const r of results) {
          console.log('DISCRETE', r.task.id, r.status);
        }

        const serve = {
          id: '${mylib}:serve',
          target: { project: '${mylib}', target: 'serve' },
          overrides: { __overrides_unparsed__: '' },
          outputs: [],
          parallelism: true,
          continuous: true,
        };
        const running = await runContinuousTasks(
          [serve],
          projectGraph,
          makeTaskGraph([serve]),
          nxJson,
          lifeCycle
        );
        for (const [id, handlePromise] of Object.entries(running)) {
          const handle = await handlePromise;
          await handle.kill();
          console.log('CONTINUOUS', id);
        }
      }

      main().then(() => {
        console.log('DONE');
        process.exit(0);
      }).catch((e) => {
        console.error(e);
        process.exit(1);
      });
    `
    );

    const q = runCommand('node runner.js');
    expect(q).toContain(`DISCRETE ${mylib}:prebuild`);
    expect(q).toContain(`DISCRETE ${mylib}:build`);
    expect(q).toContain(`CONTINUOUS ${mylib}:serve`);
    expect(q).toContain(`DONE`);
  });
});
