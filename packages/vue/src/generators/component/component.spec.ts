import { logger, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from './component';
import { createLib } from '../../utils/test-utils';

describe('component', () => {
  let appTree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-lib';
    appTree = createTreeWithEmptyWorkspace();
    await createLib(appTree, projectName);
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate files with vitest', async () => {
    await componentGenerator(appTree, {
      name: 'hello',
      project: projectName,
      unitTestRunner: 'vitest',
    });

    expect(
      appTree.exists('my-lib/src/components/hello/hello.vue')
    ).toBeTruthy();
    expect(
      appTree.exists('my-lib/src/components/hello/__tests__/hello.spec.ts')
    ).toBeTruthy();

    expect(
      appTree.read('my-lib/src/components/hello/hello.vue', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'my-lib/src/components/hello/__tests__/hello.spec.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should generate files with jest', async () => {
    await componentGenerator(appTree, {
      name: 'hello',
      project: projectName,
      unitTestRunner: 'jest',
    });

    expect(
      appTree.read('my-lib/src/components/hello/hello.vue', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'my-lib/src/components/hello/__tests__/hello.spec.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  // we don't have app generator yet
  xit('should generate files for an app', async () => {
    await componentGenerator(appTree, {
      name: 'hello',
      project: 'my-app',
      unitTestRunner: 'vitest',
    });

    expect(
      appTree.exists('my-app/src/components/hello/hello.tsx')
    ).toBeTruthy();
    expect(
      appTree.exists('my-app/src/components/hello/hello.spec.ts')
    ).toBeTruthy();
    expect(
      appTree.exists('my-app/src/components/hello/hello.module.css')
    ).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        export: true,
      });
      expect(appTree.read('my-lib/src/index.ts', 'utf-8')).toMatchSnapshot();
    });

    // no app generator yet
    xit('should not export from an app', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: 'my-app',
        export: true,
      });

      expect(appTree.read('my-app/src/index.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate component files with upper case names', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        pascalCaseFiles: true,
      });
      expect(
        appTree.exists('my-lib/src/components/hello/Hello.vue')
      ).toBeTruthy();
      expect(
        appTree.exists('my-lib/src/components/hello/__tests__/Hello.spec.ts')
      ).toBeTruthy();
    });
  });

  describe('--pascalCaseDirectory', () => {
    it('should generate component files with pascal case directories', async () => {
      await componentGenerator(appTree, {
        name: 'hello-world',
        project: projectName,
        pascalCaseFiles: true,
        pascalCaseDirectory: true,
      });
      expect(
        appTree.exists('my-lib/src/components/HelloWorld/HelloWorld.vue')
      ).toBeTruthy();
      expect(
        appTree.exists(
          'my-lib/src/components/HelloWorld/__tests__/HelloWorld.spec.ts'
        )
      ).toBeTruthy();
    });
  });

  // TODO: figure out routing
  xdescribe('--routing', () => {
    it('should add routes to the component', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        routing: true,
      });

      const content = appTree
        .read('my-lib/src/components/hello/hello.tsx')
        .toString();
      expect(content).toContain('react-router-dom');
      expect(content).toMatch(/<Route\s*path="\/"/);
      expect(content).toMatch(/<Link\s*to="\/"/);

      const packageJSON = readJson(appTree, 'package.json');
      expect(packageJSON.dependencies['react-router-dom']).toBeDefined();
    });
  });

  describe('--directory', () => {
    it('should create component under the directory', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        directory: 'components',
      });

      expect(appTree.exists('/my-lib/src/components/hello/hello.vue'));
    });

    it('should create with nested directories', async () => {
      await componentGenerator(appTree, {
        name: 'helloWorld',
        project: projectName,
        directory: 'lib/foo',
      });

      expect(
        appTree.exists('/my-lib/src/components/foo/hello-world/hello-world.vue')
      );
    });
  });

  describe('--flat', () => {
    it('should create in project directory rather than in its own folder', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        flat: true,
      });

      expect(appTree.exists('/my-lib/src/components/hello.vue'));
    });
    it('should work with custom directory path', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: projectName,
        flat: true,
        directory: 'components',
      });

      expect(appTree.exists('/my-lib/src/components/hello.vue'));
    });
  });
});
