import { CreateNodesContextV2 } from '@nx/devkit';
import type { NextConfig } from 'next';

import { createNodesV2 } from './plugin';
import { TempFs } from '@nx/devkit/internal-testing-utils';

describe('@nx/next/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContextV2;

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
