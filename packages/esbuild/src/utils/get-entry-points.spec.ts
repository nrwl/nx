import type { ExecutorContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import * as path from 'path';
import { getEntryPoints } from './get-entry-points';

describe('getEntryPoints', () => {
  let tempFs: TempFs;
  let context: ExecutorContext;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tempFs = new TempFs('get-entry-points');
    await tempFs.createFiles({
      'apps/myapp/tsconfig.app.json': JSON.stringify({
        include: ['src/**/*.ts'],
      }),
      'apps/myapp/src/main.ts': '',
      'apps/myapp/src/lib/util.ts': '',
    });
    context = {
      root: tempFs.tempDir,
      cwd: tempFs.tempDir,
      isVerbose: false,
      projectName: 'myapp',
      nxJsonConfiguration: {},
      projectsConfigurations: {
        version: 2,
        projects: {
          myapp: { root: 'apps/myapp' },
        },
      },
      projectGraph: {
        nodes: {
          myapp: {
            type: 'app',
            name: 'myapp',
            data: { root: 'apps/myapp' },
          },
        },
        dependencies: { myapp: [] },
      },
    };
  });

  afterEach(() => {
    process.chdir(originalCwd);
    tempFs.cleanup();
  });

  it('should find project files when cwd is the workspace root', () => {
    process.chdir(tempFs.tempDir);

    expect(getEntryPoints('myapp', context).sort()).toEqual([
      path.join('apps/myapp', 'src/lib/util.ts'),
      path.join('apps/myapp', 'src/main.ts'),
    ]);
  });

  it('should find project files when cwd is a project subdirectory', () => {
    process.chdir(path.join(tempFs.tempDir, 'apps/myapp'));

    expect(getEntryPoints('myapp', context).sort()).toEqual([
      path.join('apps/myapp', 'src/lib/util.ts'),
      path.join('apps/myapp', 'src/main.ts'),
    ]);
  });
});
