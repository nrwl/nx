import type { Mock } from 'vitest';
import { type CreateNodesContext } from '@nx/devkit';
import { createNodes } from './router-plugin';
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

    it('should infer the @nx/js/typescript typecheck target in a TS solution setup', async () => {
      (isUsingTsSolutionSetup as Mock).mockReturnValue(true);
      mockConfig('acme/react-router.config.js', {}, context);
      await tempFs.createFiles({
        'tsconfig.base.json': JSON.stringify({
          compilerOptions: { composite: true },
        }),
        'acme/tsconfig.json': JSON.stringify({
          extends: '../tsconfig.base.json',
          files: [],
          references: [],
        }),
      });

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        { buildTargetName: 'build' },
        context
      );

      const typecheck = nodes[0][1].projects['acme'].targets['typecheck'];
      expect(typecheck.command).toBe(
        'tsc --build tsconfig.json --emitDeclarationOnly'
      );
      expect(typecheck.outputs).toBeDefined();
      expect(typecheck.dependsOn).toContain('build');
    });

    it('should not infer a typecheck target when typecheckTargetName is false', async () => {
      mockConfig('acme/react-router.config.js', {}, context);

      const nodes = await createNodesFunction(
        ['acme/react-router.config.js'],
        { typecheckTargetName: false },
        context
      );

      const targets = nodes[0][1].projects['acme'].targets;
      expect(targets['typecheck']).toBeUndefined();
      expect(targets['false']).toBeUndefined();
    });
  });

  // loadConfigFile `require`s the config, which `vi.mock` cannot reach.
  function mockConfig(path: string, config, context: CreateNodesContext) {
    mockCjsModule(import.meta.url, join(context.workspaceRoot, path), config);
  }
});
