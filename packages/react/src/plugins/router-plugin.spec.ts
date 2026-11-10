import type { Mock } from 'vitest';
import { type CreateNodesContext } from '@nx/devkit';
import { createNodes } from './router-plugin';
import { canResolve } from './router-plugin-utils';
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { join } from 'path';

vi.mock('nx/src/utils/cache-directory', async () => ({
  ...(await vi.importActual<any>('nx/src/utils/cache-directory')),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

// In the vm, require.resolve ignores `paths`. By default @nx/vite resolves.
vi.mock('./router-plugin-utils', () => ({
  canResolve: vi.fn().mockReturnValue(true),
}));

vi.mock('@nx/js/internal', async () => ({
  ...(await vi.importActual<any>('@nx/js/internal')),
  isUsingTsSolutionSetup: vi.fn(),
}));

describe('@nx/react/react-router-plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(() => {
    (isUsingTsSolutionSetup as Mock).mockReturnValue(false);
  });

  describe('React Router', () => {
    beforeEach(async () => {
      tempFs = new TempFs('test');
      cwd = process.cwd();
      process.chdir(tempFs.tempDir);

      context = {
        nxJsonConfiguration: {
          namedInputs: {
            default: ['{projectRoot}/**/*'],
            production: ['!{projectRoot}/**/*.spec.ts'],
          },
        },
        workspaceRoot: tempFs.tempDir,
      };

      await tempFs.createFiles({
        'acme/react-router.config.js': 'module.exports = {}',
        'acme/vite.config.js': '',
        'acme/project.json': JSON.stringify({ name: 'acme' }),
        'acme/tsconfig.json': '{}',
      });
    });

    afterEach(() => {
      vi.resetModules();
      resetCjsMocks();
      tempFs.cleanup();
      process.chdir(cwd);
    });

    it('should create nodes by default', async () => {
      mockConfig('acme/react-router.config.js', {}, context);

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        {
          buildTargetName: 'build',
          devTargetName: 'dev',
          startTargetName: 'start',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });

    it('should create nodes without start target if ssr is false', async () => {
      mockConfig('acme/react-router.config.js', { ssr: false }, context);

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        {
          buildTargetName: 'build',
          devTargetName: 'dev',
          startTargetName: 'start',
        },
        context
      );

      expect(nodes).toMatchSnapshot();
    });

    it('should not make dev wait when the workspace cannot resolve @nx/vite/ready-check', async () => {
      mockConfig('acme/react-router.config.js', {}, context);
      (canResolve as Mock).mockReturnValueOnce(false);

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        {},
        context
      );

      const targets = nodes[0][1].projects['acme'].targets;
      expect(targets.dev.readyWhen).toBeUndefined();
    });

    it('should not create a typecheck target', async () => {
      mockConfig('acme/react-router.config.js', {}, context);

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        {},
        context
      );

      const targets = nodes[0][1].projects['acme'].targets;
      expect(targets.typecheck).toBeUndefined();
      expect(targets.build).toBeDefined();
    });
  });

  // loadConfigFile `require`s the config, which `vi.mock` cannot reach.
  function mockConfig(path: string, config, context: CreateNodesContext) {
    mockCjsModule(import.meta.url, join(context.workspaceRoot, path), config);
  }
});
