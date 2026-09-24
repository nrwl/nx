import { CreateNodesContext } from '@nx/devkit';
import type { NextConfig } from 'next';

import { createNodesV2 } from './plugin';
import { TempFs } from '@nx/devkit/internal-testing-utils';

describe('@nx/next/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;

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
      jest.resetModules();
      tempFs.cleanup();
    });

    it('should create nodes', async () => {
      const nextConfigPath = 'next.config.js';
      mockNextConfig(nextConfigPath, {});
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
      jest.resetModules();
    });

    it('should create nodes', async () => {
      mockNextConfig('my-app/next.config.js', {});
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
      jest.resetModules();
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
      jest.resetModules();
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

function mockNextConfig(path: string, config: NextConfig) {
  jest.mock(
    path,
    () => ({
      default: config,
    }),
    {
      virtual: true,
    }
  );
}
