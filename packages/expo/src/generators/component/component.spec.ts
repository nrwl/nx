import { logger, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import expoApplicationGenerator from '../application/application';
import expoLibraryGenerator from '../library/library';
import { expoComponentGenerator } from './component';
import { Schema } from './schema';

describe('component', () => {
  let appTree: Tree;
  let projectName: string;

  let defaultSchema: Schema;

  beforeEach(async () => {
    projectName = 'my-lib';
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
    defaultSchema = {
      name: 'hello',
      project: projectName,
      skipTests: false,
      export: false,
      pascalCaseFiles: false,
      classComponent: false,
      js: false,
      flat: false,
      skipFormat: true,
    };

    expoApplicationGenerator(appTree, {
      name: 'my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    });
    expoLibraryGenerator(appTree, {
      name: projectName,
      linter: Linter.EsLint,
      skipFormat: false,
      skipTsConfig: false,
      unitTestRunner: 'jest',
      strict: true,
      js: false,
    });
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate files', async () => {
    await expoComponentGenerator(appTree, defaultSchema);

    expect(appTree.exists('libs/my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(
      appTree.exists('libs/my-lib/src/lib/hello/hello.spec.tsx')
    ).toBeTruthy();
  });

  it('should generate files for an app', async () => {
    await expoComponentGenerator(appTree, {
      ...defaultSchema,
      project: 'my-app',
    });

    expect(appTree.exists('apps/my-app/src/app/hello/hello.tsx')).toBeTruthy();
    expect(
      appTree.exists('apps/my-app/src/app/hello/hello.spec.tsx')
    ).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        export: true,
      });

      const indexContent = appTree.read('libs/my-lib/src/index.ts', 'utf-8');

      expect(indexContent).toMatch(/lib\/hello/);
    });

    it('should not export from an app', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        project: 'my-app',
        export: true,
      });

      const indexContent = appTree.read('libs/my-lib/src/index.ts', 'utf-8');

      expect(indexContent).not.toMatch(/lib\/hello/);
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate component files with upper case names', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
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
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        directory: 'components',
      });

      expect(appTree.exists('/libs/my-lib/src/components/hello/hello.tsx'));
    });

    it('should create with nested directories', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        name: 'helloWorld',
        directory: 'lib/foo',
      });

      expect(
        appTree.exists('/libs/my-lib/src/lib/foo/hello-world/hello-world.tsx')
      );
    });
  });

  describe('--flat', () => {
    it('should create in project directory rather than in its own folder', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        flat: true,
      });

      expect(appTree.exists('/libs/my-lib/src/lib/hello.tsx'));
    });
    it('should work with custom directory path', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        flat: true,
        directory: 'components',
      });

      expect(appTree.exists('/libs/my-lib/src/components/hello.tsx'));
    });
  });
});
