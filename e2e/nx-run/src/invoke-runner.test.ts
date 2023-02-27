import {
  checkFilesExist,
  cleanupProject,
  fileExists,
  isWindows,
  newProject,
  readFile,
  readJson,
  readProjectConfig,
  removeFile,
  runCLI,
  runCLIAsync,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
  updateProjectConfig,
} from '@nrwl/e2e/utils';
import { PackageJson } from 'nx/src/utils/package-json';
import * as path from 'path';

describe('Invoke Runner', () => {
  let proj: string;
  beforeAll(() => (proj = newProject()));
  afterAll(() => cleanupProject());

  it('should invoke runner imperatively ', async () => {
    const mylib = uniq('mylib');
    runCLI(`generate @nrwl/workspace:lib ${mylib}`);
    updateProjectConfig(mylib, (c) => {
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
        
        await r.invoke({tasks: [{id: '${mylib}:prebuild', target: {project: '${mylib}', target: 'prebuild'}, overrides: {__overrides_unparsed__: ''}}]});
        await r.invoke({tasks: [{id: '${mylib}:build', target: {project: '${mylib}', target: 'build'}, overrides: {__overrides_unparsed__: ''}}]});
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
