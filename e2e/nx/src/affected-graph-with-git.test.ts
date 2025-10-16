import type { NxJsonConfiguration } from '@nx/devkit';
import {
  isNotWindows,
  readFile,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  removeFile,
} from '@nx/e2e-utils';
import { join } from 'path';
import {
  setupAffectedGraphTest,
  cleanupAffectedGraphTest,
} from './affected-graph-setup';

describe('Nx Affected and Graph Tests', () => {
  beforeAll(() => setupAffectedGraphTest());
  afterAll(() => cleanupAffectedGraphTest());

  describe('affected (with git)', () => {
    let myapp;
    let myapp2;
    let mylib;

    beforeEach(() => {
      myapp = uniq('myapp');
      myapp2 = uniq('myapp');
      mylib = uniq('mylib');
      const nxJson: NxJsonConfiguration = readJson('nx.json');

      updateFile('nx.json', JSON.stringify(nxJson));
      // clean up any projects from previous tests
      runCommand(`rm -rf apps libs`);
      runCommand(`mkdir -p apps libs`);
      runCommand(`git init`);
      runCommand(`git config user.email "test@test.com"`);
      runCommand(`git config user.name "Test"`);
      runCommand(`git config commit.gpgsign false`);
      try {
        runCommand(
          `git add . && git commit -am "initial commit" && git checkout -B main`
        );
      } catch (e) {}
    });

    function generateAll() {
      runCLI(
        `generate @nx/web:app apps/${myapp} --bundler=webpack --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/web:app apps/${myapp2} --bundler=webpack --unitTestRunner=vitest`
      );
      runCLI(`generate @nx/js:lib  libs/${mylib}`);
      runCommand(`git add . && git commit -am "add all"`);
    }

    it('should not affect other projects by generating a new project', () => {
      // TODO: investigate why affected gives different results on windows
      if (isNotWindows()) {
        runCLI(`generate @nx/web:app apps/${myapp}`);
        expect(runCLI('show projects --affected')).toContain(myapp);
        runCommand(`git add . && git commit -am "add ${myapp}"`);

        runCLI(`generate @nx/web:app apps/${myapp2}`);
        let output = runCLI('show projects --affected');
        expect(output).not.toContain(myapp);
        expect(output).toContain(myapp2);
        runCommand(`git add . && git commit -am "add ${myapp2}"`);

        runCLI(`generate @nx/js:lib libs/${mylib}`);
        output = runCLI('show projects --affected');
        expect(output).not.toContain(myapp);
        expect(output).not.toContain(myapp2);
        expect(output).toContain(mylib);
      }
    }, 1000000);

    it('should detect changes to projects based on tags changes', async () => {
      // TODO: investigate why affected gives different results on windows
      if (isNotWindows()) {
        generateAll();
        updateFile(join('apps', myapp, 'project.json'), (content) => {
          const data = JSON.parse(content);
          data.tags = ['tag'];
          return JSON.stringify(data, null, 2);
        });
        const output = runCLI('show projects --affected');
        expect(output).toContain(myapp);
        expect(output).not.toContain(myapp2);
        expect(output).not.toContain(mylib);
      }
    });

    it('should affect all projects by removing projects', async () => {
      generateAll();
      const root = `libs/${mylib}`;
      removeFile(root);
      const output = runCLI('show projects --affected');
      expect(output).toContain(myapp);
      expect(output).toContain(myapp2);
      expect(output).not.toContain(mylib);
    });

    it('should detect changes to implicitly dependant projects', async () => {
      generateAll();
      updateFile(join('apps', myapp, 'project.json'), (content) => {
        const data = JSON.parse(content);
        data.implicitDependencies = ['*', `!${myapp2}`];
        return JSON.stringify(data, null, 2);
      });

      runCommand('git add . && git commit -m "setup test"');
      updateFile(`libs/${mylib}/index.html`, '<html></html>');

      const output = runCLI('show projects --affected');

      expect(output).toContain(myapp);
      expect(output).not.toContain(myapp2);
      expect(output).toContain(mylib);

      // Clear implicit deps to not interfere with other tests.

      updateFile(join('apps', myapp, 'project.json'), (content) => {
        const data = JSON.parse(content);
        data.implicitDependencies = [];
        return JSON.stringify(data, null, 2);
      });
    });

    it('should handle file renames', () => {
      generateAll();

      // Move file
      updateFile(
        `apps/${myapp2}/src/index.html`,
        readFile(`apps/${myapp}/src/index.html`)
      );
      removeFile(`apps/${myapp}/src/index.html`);

      const affectedProjects = runCLI('show projects --affected --uncommitted');
      // .replace(
      //   /.*nx print-affected --uncommitted --select projects( --verbose)?\n/,
      //   ''
      // )
      // .split(', ');

      expect(affectedProjects).toContain(myapp);
      expect(affectedProjects).toContain(myapp2);
    });
  });
});
