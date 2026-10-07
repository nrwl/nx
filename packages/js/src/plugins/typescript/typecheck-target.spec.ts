import { detectPackageManager, type CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { getLockFileName, setupWorkspaceContext } from '@nx/devkit/internal';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createNodesV2, createTypecheckTargets } from './plugin';

vi.mock('nx/src/utils/cache-directory', async () => ({
  ...(await vi.importActual<any>('nx/src/utils/cache-directory')),
  workspaceDataDirectory: 'tmp/project-graph-cache',
}));

describe('createTypecheckTargets', () => {
  let context: CreateNodesContext;
  let cwd = process.cwd();
  let tempFs: TempFs;
  let originalCacheProjectGraph: string | undefined;

  beforeEach(async () => {
    mkdirSync('tmp/project-graph-cache', { recursive: true });
    tempFs = new TempFs('typecheck-target');
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };
    process.chdir(tempFs.tempDir);
    originalCacheProjectGraph = process.env.NX_CACHE_PROJECT_GRAPH;
    process.env.NX_CACHE_PROJECT_GRAPH = 'false';
    await createWorkspace({
      [getLockFileName(detectPackageManager(context.workspaceRoot))]: '',
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: { composite: true, declaration: true },
      }),
      'libs/a/package.json': JSON.stringify({ name: 'a' }),
      'libs/a/tsconfig.json': JSON.stringify({
        extends: '../../tsconfig.base.json',
        files: [],
        references: [{ path: './tsconfig.lib.json' }, { path: '../b' }],
      }),
      'libs/a/tsconfig.lib.json': JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { outDir: 'dist' },
        include: ['src/**/*.ts'],
      }),
      'libs/b/package.json': JSON.stringify({ name: 'b' }),
      'libs/b/tsconfig.json': JSON.stringify({
        extends: '../../tsconfig.base.json',
        files: [],
        references: [{ path: './tsconfig.lib.json' }],
      }),
      'libs/b/tsconfig.lib.json': JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { outDir: 'dist' },
        include: ['src/**/*.ts'],
        references: [{ path: '../c' }],
      }),
      'libs/c/package.json': JSON.stringify({ name: 'c' }),
      'libs/c/tsconfig.json': JSON.stringify({
        extends: '../../tsconfig.base.json',
        files: [],
      }),
    });
  });

  afterEach(() => {
    vi.resetModules();
    tempFs.cleanup();
    process.chdir(cwd);
    process.env.NX_CACHE_PROJECT_GRAPH = originalCacheProjectGraph;
    rmSync('tmp/project-graph-cache', { recursive: true, force: true });
  });

  it('should match the typecheck target inferred by @nx/js/typescript', async () => {
    const targets = await createTypecheckTargets(
      [{ projectRoot: 'libs/a' }],
      context
    );

    const results = await createNodesV2[1](
      [
        'libs/a/tsconfig.json',
        'libs/a/tsconfig.lib.json',
        'libs/b/tsconfig.json',
        'libs/b/tsconfig.lib.json',
        'libs/c/tsconfig.json',
      ],
      {},
      context
    );
    const [, nodes] = results.find(([file]) => file === 'libs/a/tsconfig.json');

    expect(targets['libs/a']).toEqual(
      nodes.projects['libs/a'].targets.typecheck
    );
    expect(targets['libs/a'].inputs).toContain(
      '^{projectRoot}/tsconfig.lib.json'
    );
  });

  it('should depend on the build target passed for the project', async () => {
    const targets = await createTypecheckTargets(
      [
        { projectRoot: 'libs/a', buildTargetName: 'build' },
        { projectRoot: 'libs/b' },
      ],
      context,
      'check-types'
    );

    expect(targets['libs/a'].dependsOn).toEqual(['build', '^check-types']);
    expect(targets['libs/b'].dependsOn).toEqual(['^check-types']);
  });

  it('should use the compiler passed for the project', async () => {
    const targets = await createTypecheckTargets(
      [{ projectRoot: 'libs/a', compiler: 'vue-tsc' }],
      context
    );

    expect(targets['libs/a'].command).toBe(
      'vue-tsc --build tsconfig.json --emitDeclarationOnly'
    );
  });

  it('should leave out projects without a tsconfig.json', async () => {
    const targets = await createTypecheckTargets(
      [{ projectRoot: 'libs/missing' }, { projectRoot: 'libs/a' }],
      context
    );

    expect(Object.keys(targets)).toEqual(['libs/a']);
  });

  it('should leave out projects whose tsconfig opts out of the typecheck target', async () => {
    await createWorkspace({
      'libs/c/tsconfig.json': JSON.stringify({
        files: [],
        nx: { addTypecheckTarget: false },
      }),
    });

    const targets = await createTypecheckTargets(
      [{ projectRoot: 'libs/c' }],
      context
    );

    expect(targets).toEqual({});
  });

  describe('caching', () => {
    beforeEach(() => {
      process.env.NX_CACHE_PROJECT_GRAPH = 'true';
    });

    it('should reuse the persisted target while its tsconfigs are unchanged', async () => {
      await createTypecheckTargets([{ projectRoot: 'libs/a' }], context);
      const cacheFile = readdirSync(
        join(tempFs.tempDir, 'tmp/project-graph-cache')
      ).find((file) => file.startsWith('tsc-typecheck-'));
      const cachePath = join(
        tempFs.tempDir,
        'tmp/project-graph-cache',
        cacheFile
      );
      const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
      for (const target of Object.values<any>(cached)) {
        target.command = 'from-cache';
      }
      writeFileSync(cachePath, JSON.stringify(cached));

      const targets = await createTypecheckTargets(
        [{ projectRoot: 'libs/a' }],
        context
      );

      expect(targets['libs/a'].command).toBe('from-cache');
    });

    it('should rebuild the target when a referenced project tsconfig changes', async () => {
      await createTypecheckTargets([{ projectRoot: 'libs/a' }], context);
      await createWorkspace({
        'libs/b/tsconfig.json': JSON.stringify({
          extends: '../../tsconfig.base.json',
          compilerOptions: { noEmit: true },
          files: [],
        }),
      });

      const targets = await createTypecheckTargets(
        [{ projectRoot: 'libs/a' }],
        context
      );

      expect(targets['libs/a'].command).toMatch(/^echo /);
    });
  });

  async function createWorkspace(files: Record<string, string>) {
    await tempFs.createFiles(files);
    setupWorkspaceContext(tempFs.tempDir);
  }
});
