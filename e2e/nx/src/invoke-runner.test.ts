import {
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e/utils';
import { join } from 'path';

describe('Invoke Runner', () => {
  let proj: string;
  beforeAll(() => (proj = newProject({ packages: ['@nx/js'] })));
  afterAll(() => cleanupProject());

  it('should invoke runner imperatively ', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nx/js:lib libs/${mylib}`);
    updateJson(join('libs', mylib, 'project.json'), (c) => {
      c.targets['prebuild'] = {
        command: 'echo prebuild',
      };
      c.targets['build'] = {
        command: 'echo build',
      };
      return c;
    });

    updateFile(
      'runner.js',
      `
      const { initTasksRunner } = require('nx/src/index');

      async function main(){
        const r = await initTasksRunner({});

        await r.invoke({tasks: [{id: '${mylib}:prebuild', target: {project: '${mylib}', target: 'prebuild'}, outputs: [], overrides: {__overrides_unparsed__: ''}}]});
        await r.invoke({tasks: [{id: '${mylib}:build', target: {project: '${mylib}', target: 'build'}, outputs: [], overrides: {__overrides_unparsed__: ''}}]});
      }

      main().then(q => {
        console.log("DONE")
        process.exit(0)
      })
    `
    );

    const q = runCommand('node runner.js');
    expect(q).toContain(`Task ${mylib}:prebuild`);
    expect(q).toContain(`Task ${mylib}:build`);
    expect(q).toContain(`Successfully ran 1 tasks`);
    expect(q).toContain(`DONE`);
  });
});
