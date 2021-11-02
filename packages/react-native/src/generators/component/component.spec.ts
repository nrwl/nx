import { logger, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
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

  it('should generate files', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'hello',
      project: projectName,
    });

    expect(appTree.exists('libs/my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(
      appTree.exists('libs/my-lib/src/lib/hello/hello.spec.tsx')
    ).toBeTruthy();
  });

  it('should generate files for an app', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'hello',
      project: 'my-app',
    });

    expect(appTree.exists('apps/my-app/src/app/hello/hello.tsx')).toBeTruthy();
    expect(
      appTree.exists('apps/my-app/src/app/hello/hello.spec.tsx')
    ).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        export: true,
      });

      const indexContent = appTree.read('libs/my-lib/src/index.ts', 'utf-8');

      expect(indexContent).toMatch(/lib\/hello/);
    });

    it('should not export from an app', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        project: 'my-app',
        export: true,
      });

      const indexContent = appTree.read('libs/my-lib/src/index.ts', 'utf-8');

      expect(indexContent).not.toMatch(/lib\/hello/);
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate component files with upper case names', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        pascalCaseFiles: true,
      });
      expect(
        appTree.exists('libs/my-lib/src/lib/hello/Hello.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists('libs/my-lib/src/lib/hello/Hello.spec.tsx')
      ).toBeTruthy();
    });
  });

  describe('--directory', () => {
    it('should create component under the directory', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        directory: 'components',
      });

      expect(appTree.exists('/libs/my-lib/src/components/hello/hello.tsx'));
    });

    it('should create with nested directories', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'helloWorld',
        project: projectName,
        directory: 'lib/foo',
      });

      expect(
        appTree.exists('/libs/my-lib/src/lib/foo/hello-world/hello-world.tsx')
      );
    });
  });

  describe('--flat', () => {
    it('should create in project directory rather than in its own folder', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        flat: true,
      });

      expect(appTree.exists('/libs/my-lib/src/lib/hello.tsx'));
    });
    it('should work with custom directory path', async () => {
      await reactNativeComponentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        flat: true,
        directory: 'components',
      });

      expect(appTree.exists('/libs/my-lib/src/components/hello.tsx'));
    });
  });
});
