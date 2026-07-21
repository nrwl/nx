import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { join } from 'node:path';

// `var` rather than `let`: transitive imports read `workspaceRoot` while the
// module graph is still loading, before a `let` would leave its temporal dead
// zone.
var workspaceRootMock: string | undefined;
jest.mock('@nx/devkit', () => {
  const actual = jest.requireActual('@nx/devkit');
  return {
    ...actual,
    get workspaceRoot() {
      return workspaceRootMock ?? actual.workspaceRoot;
    },
  };
});

var failRootTsConfigLoad = false;
jest.mock('tsconfig-paths', () => {
  const actual = jest.requireActual('tsconfig-paths');
  return {
    ...actual,
    loadConfig: (path?: string) =>
      failRootTsConfigLoad && path?.endsWith('tsconfig.base.json')
        ? { resultType: 'failed', message: "Couldn't find tsconfig.json" }
        : actual.loadConfig(path),
  };
});

import { nxViteTsPaths } from './nx-tsconfig-paths.plugin';

describe('nxViteTsPaths', () => {
  let tempFs: TempFs;
  let originalTsConfigPath: string | undefined;

  beforeEach(() => {
    tempFs = new TempFs('nx-vite-ts-paths');
    workspaceRootMock = tempFs.tempDir;
    originalTsConfigPath = process.env.NX_TSCONFIG_PATH;
    failRootTsConfigLoad = false;
  });

  afterEach(() => {
    if (originalTsConfigPath === undefined) {
      delete process.env.NX_TSCONFIG_PATH;
    } else {
      process.env.NX_TSCONFIG_PATH = originalTsConfigPath;
    }
    tempFs.cleanup();
  });

  const resolveWith = async (importPath: string) => {
    const plugin = nxViteTsPaths();
    await (plugin as any).configResolved({
      root: join(tempFs.tempDir, 'app'),
      command: 'build',
      plugins: [],
    });
    return (plugin as any).resolveId(importPath);
  };

  const withProjectTsConfigOutsideWorkspace = async () => {
    await tempFs.createFiles({
      'external/tsconfig.json': JSON.stringify({
        compilerOptions: { baseUrl: '.', paths: { '@ext/*': ['libs/*'] } },
      }),
      'app/src/main.ts': '',
    });
    process.env.NX_TSCONFIG_PATH = join(
      tempFs.tempDir,
      'external/tsconfig.json'
    );
  };

  it('should defer to other resolvers when the workspace has no root-level tsconfig', async () => {
    await withProjectTsConfigOutsideWorkspace();

    await expect(resolveWith('@nope/missing')).resolves.toBeNull();
  });

  it('should defer to other resolvers when the root-level tsconfig cannot be loaded', async () => {
    await withProjectTsConfigOutsideWorkspace();
    await tempFs.createFiles({ 'tsconfig.base.json': JSON.stringify({}) });
    failRootTsConfigLoad = true;

    await expect(resolveWith('@nope/missing')).resolves.toBeNull();
  });

  it('should resolve a workspace alias through the root-level tsconfig', async () => {
    await tempFs.createFiles({
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: { '@repo/util': ['libs/util/index.ts'] },
        },
      }),
      'libs/util/index.ts': '',
      'app/src/main.ts': '',
    });

    await expect(resolveWith('@repo/util')).resolves.toEqual(
      join(tempFs.tempDir, 'libs/util/index.ts')
    );
  });
});
