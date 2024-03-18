import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e/utils';
import { ChildProcess } from 'child_process';

const myApp = uniq('my-app');
const myVueApp = uniq('my-vue-app');

describe('@nx/vite/plugin', () => {
  let proj: string;
  let originalEnv: string;
  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'true';
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  describe('with react', () => {
    beforeAll(() => {
      proj = newProject({
        packages: ['@nx/react', '@nx/vue'],
      });
      runCLI(
        `generate @nx/react:app ${myApp} --bundler=vite --unitTestRunner=vitest`
      );
      runCLI(`generate @nx/vue:app ${myVueApp} --unitTestRunner=vitest`);
    });

    afterAll(() => {
      cleanupProject();
    });

    describe('build and test React app', () => {
      it('should build application', () => {
        const result = runCLI(`build ${myApp}`);
        expect(result).toContain('Successfully ran target build');
      }, 200_000);

      it('should test application', () => {
        const result = runCLI(`test ${myApp}`);
        expect(result).toContain('Successfully ran target test');
      }, 200_000);
    });
    describe('build and test Vue app', () => {
      it('should build application', () => {
        const result = runCLI(`build ${myVueApp}`);
        expect(result).toContain('Successfully ran target build');
      }, 200_000);

      it('should test application', () => {
        const result = runCLI(`test ${myVueApp}`);
        expect(result).toContain('Successfully ran target test');
      }, 200_000);
    });

    it('should run serve-static', async () => {
      let process: ChildProcess;
      const port = 8081;

      try {
        process = await runCommandUntil(
          `serve-static ${myApp} --port=${port}`,
          (output) => {
            return output.includes(`http://localhost:${port}`);
          }
        );
      } catch (err) {
        console.error(err);
      }

      // port and process cleanup
      if (process && process.pid) {
        await killProcessAndPorts(process.pid, port);
      }
    });
  });

  describe('react with vitest only', () => {
    const reactVitest = uniq('reactVitest');

    beforeAll(() => {
      proj = newProject({
        packages: ['@nx/vite', '@nx/react'],
      });
      runCLI(
        `generate @nx/react:app ${reactVitest} --bundler=webpack --unitTestRunner=vitest --e2eTestRunner=none --projectNameAndRootFormat=as-provided`
      );
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should contain targets build, test and lint', () => {
      const nxJson = readJson('nx.json');

      const vitePlugin = nxJson.plugins.find(
        (p) => p.plugin === '@nx/vite/plugin'
      );
      expect(vitePlugin).toBeDefined();
      expect(vitePlugin.options.buildTargetName).toEqual('build');
      expect(vitePlugin.options.testTargetName).toEqual('test');
    });

    it('project.json should not contain test target', () => {
      const projectJson = readJson(`${reactVitest}/project.json`);
      expect(projectJson.targets.test).toBeUndefined();
    });
  });
});
