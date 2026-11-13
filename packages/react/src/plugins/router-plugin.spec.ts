import type { Mock } from 'vitest';
import { type CreateNodesContext } from '@nx/devkit';
import { createNodes } from './router-plugin';
import { resolveOptionalModule } from './router-plugin-utils';
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { isUsingTsSolutionSetup } from '@nx/js/internal';
import { join } from 'path';
import { fileURLToPath } from 'node:url';

vi.mock('nx/src/utils/cache-directory', async () => ({
  ...(await vi.importActual<any>('nx/src/utils/cache-directory')),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

// Vitest's require.resolve ignores paths; model missing optional modules per test.
vi.mock('./router-plugin-utils', () => ({
  resolveOptionalModule: vi.fn((request: string) => require.resolve(request)),
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
        'acme/vite.config.js': 'module.exports = {};',
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

    it.each([false, true])(
      'uses signal readiness only when the Vite config loads its plugin (%s)',
      async (signals) => {
        mockConfig('acme/react-router.config.js', {}, context);
        const pluginPath = fileURLToPath(
          new URL(
            '../../../vite/plugins/nx-ready-signal.plugin.ts',
            import.meta.url
          )
        );
        await tempFs.createFiles({
          'acme/vite.config.js': `
            import { nxReadySignal } from ${JSON.stringify(pluginPath)};
            export default async () => ({
              plugins: [false, Promise.resolve([${signals ? 'nxReadySignal()' : ''}])],
            });
          `,
        });

        const nodes = await createNodesFunction(
          ['acme/react-router.config.js'],
          {},
          context
        );

        const targets = nodes[0][1].projects['acme'].targets;
        expect(targets.dev.readyWhen).toEqual(
          signals
            ? { signal: true }
            : expect.objectContaining({
                command: expect.stringContaining('@nx/vite/ready-check'),
              })
        );
      }
    );

    it('keeps command readiness when the serve config cannot load', async () => {
      mockConfig('acme/react-router.config.js', {}, context);
      await tempFs.createFiles({
        'acme/vite.config.js': `
          module.exports = ({ command }) => {
            if (command === 'serve') {
              require('node:fs').readFileSync(${JSON.stringify(join(tempFs.tempDir, 'dev-only-cert.pem'))});
            }
            return {};
          };
        `,
      });

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        {},
        context
      );
      expect(nodes[0][1].projects['acme'].targets.dev.readyWhen).toEqual(
        expect.objectContaining({
          command: `node -e "require('@nx/vite/ready-check').waitForDevServer(process.argv[1], 'react-router-dev')" vite.config.js`,
        })
      );
    });

    it('keeps command readiness when Vite cannot resolve', async () => {
      mockConfig('acme/react-router.config.js', {}, context);
      const module = require('node:module');
      const resolveFilename = module._resolveFilename;
      const resolverSpy = vi
        .spyOn(module, '_resolveFilename')
        .mockImplementation(function (request, ...args) {
          if (request === 'vite' || request === 'vite/package.json') {
            throw Object.assign(new Error('Vite is unavailable'), {
              code: 'MODULE_NOT_FOUND',
            });
          }
          return resolveFilename.call(this, request, ...args);
        });

      try {
        const nodes = await createNodesFunction(
          ['acme/react-router.config.js'],
          {},
          context
        );
        expect(nodes[0][1].projects['acme'].targets.dev.readyWhen).toEqual(
          expect.objectContaining({
            command: `node -e "require('@nx/vite/ready-check').waitForDevServer(process.argv[1], 'react-router-dev')" vite.config.js`,
          })
        );
      } finally {
        resolverSpy.mockRestore();
      }
    });

    it('should not make dev wait when the workspace cannot resolve @nx/vite/ready-check', async () => {
      mockConfig('acme/react-router.config.js', {}, context);
      (resolveOptionalModule as Mock).mockReturnValueOnce(null);

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
