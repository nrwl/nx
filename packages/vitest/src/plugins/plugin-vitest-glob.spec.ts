import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { createNodesV2 } from './plugin';
import { loadViteDynamicImport } from '../utils/executor-utils';

// Only the Vite/Vitest module loading is mocked; the filesystem and the
// workspace-context glob are real. These tests pin the native glob's semantics
// for the patterns Vitest resolves with (the extglob default include, `**`
// matching zero segments, ignore-file behavior) against real files.
jest.mock('../utils/executor-utils', () => ({
  loadViteDynamicImport: jest.fn(),
  loadVitestConfigDynamicImport: jest.fn().mockResolvedValue({
    configDefaults: {
      include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
      exclude: ['**/node_modules/**', '**/.git/**'],
      typecheck: {
        include: ['**/*.{test,spec}-d.?(c|m)[jt]s?(x)'],
        exclude: ['**/node_modules/**', '**/.git/**'],
      },
    },
  }),
}));

jest.mock('vitest/node', () => ({
  createVitest: jest.fn(() => {
    throw new Error('these tests must take the glob discovery path');
  }),
}));

process.env.NX_DAEMON = 'false';
process.env.NX_CACHE_PROJECT_GRAPH = 'false';

describe('@nx/vitest glob discovery against a real filesystem', () => {
  const createNodesFunction = createNodesV2[1];
  let temp: TempFs;
  let context: CreateNodesContext;

  function mockResolvedTestConfig(test: Record<string, any>): void {
    (loadViteDynamicImport as jest.Mock).mockResolvedValue({
      resolveConfig: jest.fn().mockResolvedValue({
        path: 'vitest.config.ts',
        config: {},
        dependencies: [],
        test,
      }),
    });
  }

  async function getAtomizedTargets(configFile: string): Promise<string[]> {
    const nodes = await createNodesFunction(
      [configFile],
      { testTargetName: 'test', ciTargetName: 'test-ci' },
      context
    );
    const [, result] = nodes[0];
    const project = Object.values(result.projects!)[0];
    return Object.keys(project.targets!)
      .filter((name) => name.startsWith('test-ci--'))
      .sort();
  }

  beforeEach(async () => {
    temp = new TempFs('vitest-plugin-glob');
    await temp.createFiles({
      'nx.json': '{}',
      'package.json': '{"name":"repo"}',
      '.gitignore': 'node_modules/\ngenerated/\n',
    });
    context = {
      nxJsonConfiguration: {
        targetDefaults: {},
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: temp.tempDir,
      configFiles: [],
    };
  });

  afterEach(() => {
    temp.cleanup();
    jest.clearAllMocks();
  });

  it('should discover spec files matching the Vitest extglob default include', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib1/src/b.test.tsx': '',
      'libs/lib1/src/deep/nested/c.spec.mts': '',
      'libs/lib1/src/helper.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual([
      'test-ci--src/a.spec.ts',
      'test-ci--src/b.test.tsx',
      'test-ci--src/deep/nested/c.spec.mts',
    ]);
  });

  it('should scope discovery to the project root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib2/vitest.config.ts': '',
      'libs/lib2/package.json': '{"name":"lib2"}',
      'libs/lib2/src/other.spec.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should drop files an include pattern reaches outside the project root', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      'libs/lib2/package.json': '{"name":"lib2"}',
      'libs/lib2/src/other.spec.ts': '',
    });
    // An escaping pattern resolves to a real workspace path (`libs/lib2/**`),
    // so the glob matches lib2's spec; only the project-root filter drops it.
    mockResolvedTestConfig({
      include: ['src/**/*.spec.ts', '../lib2/**/*.spec.ts'],
    });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should honor config include/exclude, with `**` matching zero segments', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      // `custom/**/*.spec.ts` must match a file directly in `custom` and
      // `**/skip/**` must exclude a directory directly under the project root
      // — both require `**` to match zero path segments, like Vitest's glob.
      'libs/lib1/custom/a.spec.ts': '',
      'libs/lib1/custom/deep/b.spec.ts': '',
      'libs/lib1/custom/skip/c.spec.ts': '',
      'libs/lib1/skip/d.spec.ts': '',
      'libs/lib1/src/not-included.spec.ts': '',
    });
    mockResolvedTestConfig({
      include: ['custom/**/*.spec.ts', 'skip/**/*.spec.ts'],
      exclude: ['**/skip/**'],
    });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual([
      'test-ci--custom/a.spec.ts',
      'test-ci--custom/deep/b.spec.ts',
    ]);
  });

  it('should keep only in-source candidates containing the vitest marker', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/with-tests.ts':
        'export const x = 1;\nif (import.meta.vitest) { /* in-source test */ }\n',
      'libs/lib1/src/plain.ts': 'export const y = 2;\n',
    });
    mockResolvedTestConfig({ includeSource: ['src/**/*.ts'] });

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/with-tests.ts']);
  });

  it('should not discover ignored files (discovery follows the workspace file index)', async () => {
    await temp.createFiles({
      'libs/lib1/vitest.config.ts': '',
      'libs/lib1/package.json': '{"name":"lib1"}',
      'libs/lib1/src/a.spec.ts': '',
      // `generated/` is gitignored at the workspace root; Vitest itself would
      // run this file, but files ignored by git are not candidates here.
      'libs/lib1/generated/gen.spec.ts': '',
      'libs/lib1/node_modules/dep/d.spec.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(
      getAtomizedTargets('libs/lib1/vitest.config.ts')
    ).resolves.toEqual(['test-ci--src/a.spec.ts']);
  });

  it('should discover tests for a workspace-root project', async () => {
    await temp.createFiles({
      'vitest.config.ts': '',
      'src/root.spec.ts': '',
    });
    mockResolvedTestConfig({});

    await expect(getAtomizedTargets('vitest.config.ts')).resolves.toEqual([
      'test-ci--src/root.spec.ts',
    ]);
  });
});
