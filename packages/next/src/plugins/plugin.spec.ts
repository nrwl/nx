import { CreateNodesContext } from '@nx/devkit';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import type { NextConfig } from 'next';
import type { Mock } from 'vitest';

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { workspaceDataDirectory } from '@nx/devkit/internal';
import { createNodesV2 } from './plugin';
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';

vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(),
}));

describe('@nx/next/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;

  beforeEach(() => {
    (isUsingTsSolutionSetup as Mock).mockReturnValue(true);
  });

  describe('root projects', () => {
    let tempFs: TempFs;
    beforeEach(async () => {
      tempFs = new TempFs('next-root-plugin');
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };
      tempFs.createFileSync('next.config.js', '');
      tempFs.createFileSync('package.json', JSON.stringify({ name: 'next' }));
      tempFs.createFileSync('package-lock.json', '{}');
    });

    afterEach(() => {
      vi.resetModules();
      resetCjsMocks();
      tempFs.cleanup();
    });

    it('should create nodes', async () => {
      const nextConfigPath = 'next.config.js';
      mockNextConfig(tempFs.tempDir, nextConfigPath, {});
      const nodes = await createNodesFunction(
        [nextConfigPath],
        {
          buildTargetName: 'build',
          devTargetName: 'dev',
          startTargetName: 'start',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });

  describe('integrated projects', () => {
    const tempFs = new TempFs('test');
    beforeEach(() => {
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };

      tempFs.createFileSync(
        'my-app/project.json',
        JSON.stringify({ name: 'my-app' })
      );
      tempFs.createFileSync('my-app/next.config.js', '');
      tempFs.createFileSync('package-lock.json', '{}');
    });

    afterEach(() => {
      vi.resetModules();
      resetCjsMocks();
    });

    it('should create nodes', async () => {
      mockNextConfig(tempFs.tempDir, 'my-app/next.config.js', {});
      const nodes = await createNodesFunction(
        ['my-app/next.config.js'],
        {
          buildTargetName: 'my-build',
          devTargetName: 'my-serve',
          startTargetName: 'my-start',
          serveStaticTargetName: 'my-serve-static',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });
  });
  describe('TS solution setup', () => {
    let tempFs: TempFs;

    beforeEach(() => {
      if (existsSync(workspaceDataDirectory)) {
        for (const file of readdirSync(workspaceDataDirectory)) {
          if (file.startsWith('next-')) {
            rmSync(join(workspaceDataDirectory, file), { force: true });
          }
        }
      }
      tempFs = new TempFs('next-ts-solution');
      context = {
        nxJsonConfiguration: {},
        workspaceRoot: tempFs.tempDir,
      };
      tempFs.createFileSync(
        'apps/ts-solution-app/package.json',
        JSON.stringify({ name: 'ts-solution-app' })
      );
      tempFs.createFileSync('apps/ts-solution-app/next.config.js', '');
      tempFs.createFileSync('package-lock.json', '{}');
      mockNextConfig(tempFs.tempDir, 'apps/ts-solution-app/next.config.js', {});
    });

    afterEach(() => {
      vi.resetModules();
      resetCjsMocks();
      tempFs.cleanup();
    });

    async function getBuildTarget() {
      const nodes = await createNodesFunction(
        ['apps/ts-solution-app/next.config.js'],
        { buildTargetName: 'build' },
        context
      );
      return nodes[0][1].projects['apps/ts-solution-app'].targets['build'];
    }

    it('should make build depend on the typecheck of dependencies', async () => {
      const buildTarget = await getBuildTarget();

      expect(buildTarget.dependsOn).toEqual(['^build', '^typecheck']);
      expect(buildTarget.syncGenerators).toEqual(['@nx/js:typescript-sync']);
    });

    it('should use the typecheck target name configured for @nx/js/typescript', async () => {
      context.nxJsonConfiguration.plugins = [
        {
          plugin: '@nx/js/typescript',
          options: { typecheck: { targetName: 'check-types' } },
        },
      ];

      const buildTarget = await getBuildTarget();

      expect(buildTarget.dependsOn).toEqual(['^build', '^check-types']);
    });

    it('should not depend on the typecheck of dependencies when @nx/js/typescript disables it', async () => {
      context.nxJsonConfiguration.plugins = [
        { plugin: '@nx/js/typescript', options: { typecheck: false } },
      ];

      const buildTarget = await getBuildTarget();

      expect(buildTarget.dependsOn).toEqual(['^build']);
    });

    it('should not depend on the typecheck of dependencies outside a TS solution setup', async () => {
      (isUsingTsSolutionSetup as Mock).mockReturnValue(false);

      const buildTarget = await getBuildTarget();

      expect(buildTarget.dependsOn).toEqual(['^build']);
      expect(buildTarget.syncGenerators).toBeUndefined();
    });
  });

  describe('output directory resolution', () => {
    let tempFs: TempFs;

    beforeEach(() => {
      tempFs = new TempFs('test-output-dir');
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };
      tempFs.createFileSync(
        'my-app/project.json',
        JSON.stringify({ name: 'my-app' })
      );
      tempFs.createFileSync('package-lock.json', '{}');
    });

    afterEach(() => {
      vi.resetModules();
      resetCjsMocks();
      tempFs.cleanup();
    });

    async function buildOutputsFor(nextConfigSource: string) {
      tempFs.createFileSync('my-app/next.config.js', nextConfigSource);

      const nodes = await createNodesFunction(
        ['my-app/next.config.js'],
        {
          buildTargetName: 'my-build',
          devTargetName: 'my-serve',
          startTargetName: 'my-start',
          serveStaticTargetName: 'my-serve-static',
        },
        context
      );

      return nodes[0][1].projects['my-app'].targets['my-build'].outputs;
    }

    function outputsFor(dir: string) {
      return [
        `{workspaceRoot}/my-app/${dir}/!(cache)/**/*`,
        `{workspaceRoot}/my-app/${dir}/!(cache)`,
      ];
    }

    it('should use out/ when output is export', async () => {
      expect(
        await buildOutputsFor(`module.exports = { output: 'export' };`)
      ).toEqual(outputsFor('out'));
    });

    it('should prefer distDir over output export', async () => {
      expect(
        await buildOutputsFor(
          `module.exports = { output: 'export', distDir: 'custom-dist' };`
        )
      ).toEqual(outputsFor('custom-dist'));
    });

    // `withNx` injects `distDir: '.next'` while `global.NX_GRAPH_CREATION` is
    // set, which is when this plugin runs, so an explicit `.next` must not be
    // read as a custom export directory.
    it('should use out/ when output is export and distDir is explicitly .next', async () => {
      expect(
        await buildOutputsFor(
          `module.exports = { output: 'export', distDir: '.next' };`
        )
      ).toEqual(outputsFor('out'));
    });

    it('should use distDir when output is not export', async () => {
      expect(
        await buildOutputsFor(`module.exports = { distDir: 'build' };`)
      ).toEqual(outputsFor('build'));
    });

    it('should use out/ when a config function returns output export', async () => {
      expect(
        await buildOutputsFor(`module.exports = () => ({ output: 'export' });`)
      ).toEqual(outputsFor('out'));
    });

    it('should use out/ when an async config function returns output export', async () => {
      expect(
        await buildOutputsFor(
          `module.exports = async () => ({ output: 'export' });`
        )
      ).toEqual(outputsFor('out'));
    });
  });

  describe('root projects with output export', () => {
    let tempFs: TempFs;

    beforeEach(() => {
      tempFs = new TempFs('test-root-output-export');
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };
      tempFs.createFileSync('package.json', JSON.stringify({ name: 'root' }));
      tempFs.createFileSync('package-lock.json', '{}');
    });

    afterEach(() => {
      vi.resetModules();
      resetCjsMocks();
      tempFs.cleanup();
    });

    it('should use out/ as output dir when output is export', async () => {
      tempFs.createFileSync(
        'next.config.js',
        `module.exports = { output: 'export' };`
      );

      const nodes = await createNodesFunction(
        ['next.config.js'],
        {
          buildTargetName: 'build',
          devTargetName: 'dev',
          startTargetName: 'start',
          serveStaticTargetName: 'serve-static',
        },
        context
      );

      expect(nodes[0][1].projects['.'].targets['build'].outputs).toEqual([
        '{projectRoot}/out/!(cache)/**/*',
        '{projectRoot}/out/!(cache)',
      ]);
    });
  });
});

// loadConfigFile `require`s the config, which `vi.mock` cannot reach.
function mockNextConfig(root: string, path: string, config: NextConfig) {
  mockCjsModule(import.meta.url, join(root, path), { default: config });
}
