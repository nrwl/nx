import 'nx/src/internal-testing-utils/mock-project-graph';

import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createApp, createLib } from '../../utils/testing-generators';
import { reactNativeComponentGenerator } from './component';

describe('component', () => {
  let appTree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-lib';
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
    await createApp(appTree, 'my-app');
    await createLib(appTree, projectName);
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate component files', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'hello',
      path: `${projectName}/src/lib/hello/hello`,
    });

    expect(appTree.exists('my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(appTree.exists('my-lib/src/lib/hello/hello.spec.tsx')).toBeTruthy();
  });

  it('should handle path with file extension', async () => {
    await reactNativeComponentGenerator(appTree, {
      path: `${projectName}/src/lib/hello/hello.tsx`,
    });

    expect(appTree.exists('my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(appTree.exists('my-lib/src/lib/hello/hello.spec.tsx')).toBeTruthy();
  });

  it('should generate files for an app', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'hello',
      path: 'my-app/src/app/hello/hello',
    });

    expect(appTree.exists('my-app/src/app/hello/hello.tsx')).toBeTruthy();
    expect(appTree.exists('my-app/src/app/hello/hello.spec.tsx')).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        path: `${projectName}/src/lib/hello/hello`,
        export: true,
      });

      const indexContent = appTree.read('my-lib/src/index.ts', 'utf-8');

      expect(indexContent).toMatch(/lib\/hello/);
    });

    it('should not export from an app', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        path: 'my-app/src/app/hello/hello',
        export: true,
      });

      const indexContent = appTree.read('my-lib/src/index.ts', 'utf-8');

      expect(indexContent).not.toMatch(/lib\/hello/);
    });
  });

  describe('--directory', () => {
    it('should create component under the directory', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        path: 'my-lib/src/components/hello/hello',
      });

      expect(appTree.exists('my-lib/src/components/hello/hello.tsx'));
    });

    it('should create with nested directories', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'helloWorld',
        path: 'my-lib/src/lib/foo/hello-world/hello-world',
      });

      expect(appTree.exists('my-lib/src/lib/foo/hello-world/hello-world.tsx'));
    });
  });
});
