import {
  createNonNxProjectDirectory,
  e2eCwd,
  getPackageManagerCommand,
  getPublishedVersion,
  newProject,
  readFile,
  readJson,
  runCommand,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { ensureDirSync, writeFileSync } from 'fs-extra';
import * as path from 'path';
import { major } from 'semver';

describe('global installation', () => {
  // Additionally, installing Nx under e2eCwd like this still acts like a global install,
  // but is easier to cleanup and doesn't mess with the users PC if running tests locally.
  const globalsPath = path.join(e2eCwd, 'globals', 'node_modules', '.bin');

  let oldPath: string;

  beforeAll(() => {
    ensureDirSync(globalsPath);
    writeFileSync(
      path.join(path.dirname(path.dirname(globalsPath)), 'package.json'),
      JSON.stringify(
        {
          dependencies: {
            nx: getPublishedVersion(),
          },
        },
        null,
        2
      )
    );

    runCommand(getPackageManagerCommand().install, {
      cwd: path.join(e2eCwd, 'globals'),
    });

    // Update process.path to have access to modules installed in e2ecwd/node_modules/.bin,
    // this lets commands run things like `nx`. We put it at the beginning so they are found first.
    oldPath = process.env.PATH;
    process.env.PATH = globalsPath + path.delimiter + process.env.PATH;
  });

  afterAll(() => {
    process.env.PATH = oldPath;
  });

  describe('inside nx directory', () => {
    beforeAll(() => {
      newProject({ packages: [] });
    });

    it('should invoke Nx commands from local repo', () => {
      const nxJsContents = readFile('node_modules/nx/bin/nx.js');
      updateFile('node_modules/nx/bin/nx.js', `console.log('local install');`);
      let output: string;
      expect(() => {
        output = runCommand(`nx show projects`);
      }).not.toThrow();
      expect(output).toContain('local install');
      updateFile('node_modules/nx/bin/nx.js', nxJsContents);
    });

    it('should warn if local Nx has higher major version', () => {
      const packageJsonContents = readFile('node_modules/nx/package.json');
      updateJson('node_modules/nx/package.json', (json) => {
        json.version = `${major(getPublishedVersion()) + 2}.0.0`;
        return json;
      });
      let output: string;
      expect(() => {
        output = runCommand(`nx show projects`);
      }).not.toThrow();
      expect(output).toContain(`It's time to update Nx`);
      updateFile('node_modules/nx/package.json', packageJsonContents);
    });

    it('--version should display global installs version', () => {
      const packageJsonContents = readFile('node_modules/nx/package.json');
      const localVersion = `${major(getPublishedVersion()) + 2}.0.0`;
      updateJson('node_modules/nx/package.json', (json) => {
        json.version = localVersion;
        return json;
      });
      let output: string;
      expect(() => {
        output = runCommand(`nx --version`);
      }).not.toThrow();
      expect(output).toContain(`- Local: v${localVersion}`);
      expect(output).toContain(`- Global: v${getPublishedVersion()}`);
      updateFile('node_modules/nx/package.json', packageJsonContents);
    });

    it('report should display global installs version', () => {
      const packageJsonContents = readFile('node_modules/nx/package.json');
      const localVersion = `${major(getPublishedVersion()) + 2}.0.0`;
      updateJson('node_modules/nx/package.json', (json) => {
        json.version = localVersion;
        return json;
      });
      let output: string;
      expect(() => {
        output = runCommand(`nx report`);
      }).not.toThrow();
      expect(output).toEqual(
        expect.stringMatching(new RegExp(`nx.*:.*${localVersion}`))
      );
      expect(output).toEqual(
        expect.stringMatching(
          new RegExp(`nx \\(global\\).*:.*${getPublishedVersion()}`)
        )
      );
      updateFile('node_modules/nx/package.json', packageJsonContents);
    });
  });

  describe('non-nx directory', () => {
    beforeAll(() => {
      createNonNxProjectDirectory();
    });

    it('--version should report global version and local not found', () => {
      let output: string;
      expect(() => {
        output = runCommand(`nx --version`);
      }).not.toThrow();
      expect(output).toContain(`- Local: Not found`);
      expect(output).toContain(`- Global: v${getPublishedVersion()}`);
    });

    it('graph should work in npm workspaces repo', () => {
      expect(() => {
        runCommand(`nx graph --file graph.json`);
      }).not.toThrow();
      const { graph } = readJson('graph.json');
      expect(graph).toHaveProperty('nodes');
    });
  });
});
