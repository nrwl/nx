import { CreateNodesContextV2 } from '@nx/devkit';
import type { NextConfig } from 'next';

import { createNodesV2 } from './plugin';
import { TempFs } from '@nx/devkit/internal-testing-utils';

describe('@nx/next/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;

  describe('root projects', () => {
    beforeEach(async () => {
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: '',
      };
    });

    afterEach(() => {
      jest.resetModules();
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

  describe('integrated projects with output export', () => {
    const tempFs = new TempFs('test-output-export');

    afterEach(() => {
      jest.resetModules();
    });

    it('should use out/ as output dir when output is export', async () => {
      tempFs.createFileSync(
        'my-app/project.json',
        JSON.stringify({ name: 'my-app' })
      );
      tempFs.createFileSync(
        'my-app/next.config.js',
        `module.exports = { output: 'export' };`
      );
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };

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

  describe('integrated projects with output export and custom distDir', () => {
    const tempFs = new TempFs('test-output-export-distdir');

    afterEach(() => {
      jest.resetModules();
    });

    it('should prefer distDir over output export', async () => {
      tempFs.createFileSync(
        'my-app/project.json',
        JSON.stringify({ name: 'my-app' })
      );
      tempFs.createFileSync(
        'my-app/next.config.js',
        `module.exports = { output: 'export', distDir: 'custom-dist' };`
      );
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };

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

  describe('root projects with output export', () => {
    const tempFs = new TempFs('test-root-output-export');

    afterEach(() => {
      jest.resetModules();
    });

    it('should use out/ as output dir when output is export', async () => {
      tempFs.createFileSync('package.json', JSON.stringify({ name: 'root' }));
      tempFs.createFileSync(
        'next.config.js',
        `module.exports = { output: 'export' };`
      );
      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };

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

      expect(nodes).toMatchSnapshot();
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
