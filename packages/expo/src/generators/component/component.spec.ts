import 'nx/src/internal-testing-utils/mock-project-graph';

import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
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
      path: 'my-lib/src/lib/hello/hello',
      skipTests: false,
      export: false,
      classComponent: false,
      js: false,
      skipFormat: true,
    };

    await expoApplicationGenerator(appTree, {
      directory: 'my-app',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    });
    await expoLibraryGenerator(appTree, {
      directory: projectName,
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

    expect(appTree.exists('my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(appTree.exists('my-lib/src/lib/hello/hello.spec.tsx')).toBeTruthy();
  });

  it('should generate files for an app', async () => {
    await expoComponentGenerator(appTree, {
      ...defaultSchema,
      path: 'my-app/src/app/hello/hello',
    });

    expect(appTree.exists('my-app/src/app/hello/hello.tsx')).toBeTruthy();
    expect(appTree.exists('my-app/src/app/hello/hello.spec.tsx')).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        export: true,
      });

      const indexContent = appTree.read('my-lib/src/index.ts', 'utf-8');

      expect(indexContent).toMatch(/lib\/hello/);
    });

    it('should not export from an app', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        path: 'my-lib/src/app/my-app',
        export: true,
      });

      const indexContent = appTree.read('my-lib/src/index.ts', 'utf-8');

      expect(indexContent).not.toMatch(/lib\/hello/);
    });
  });

  describe('--directory', () => {
    it('should create component under the directory', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        path: 'my-lib/src/components/hello',
      });

      expect(appTree.exists('my-lib/src/components/hello/hello.tsx'));
    });

    it('should create with nested directories', async () => {
      await expoComponentGenerator(appTree, {
        ...defaultSchema,
        name: 'helloWorld',
        path: 'my-lib/src/lib/foo/hello-world',
      });

      expect(appTree.exists('my-lib/src/lib/foo/hello-world/hello-world.tsx'));
    });
  });
});
