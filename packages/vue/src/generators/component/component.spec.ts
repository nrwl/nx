import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from './component';
import { createApp, createLib } from '../../utils/test-utils';

describe('component', () => {
  let appTree: Tree;
  let libName: string;
  let appName: string;

  beforeEach(async () => {
    libName = 'my-lib';
    appName = 'my-app';
    appTree = createTreeWithEmptyWorkspace();
    await createLib(appTree, libName);
    await createApp(appTree, appName);
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate files with vitest', async () => {
    await componentGenerator(appTree, {
      name: 'hello',
      project: libName,
    });

    expect(appTree.read(`${libName}/src/lib/hello/hello.vue`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "<script setup lang="ts">
      // defineProps<{}>()
      </script>

      <template>
        <p>Welcome to Hello!</p>
      </template>

      <style scoped></style>
      "
    `);
    expect(appTree.read(`${libName}/src/lib/hello/hello.spec.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { mount } from '@vue/test-utils';
      import Hello from './hello.vue';

      describe('Hello', () => {
        it('renders properly', () => {
          const wrapper = mount(Hello, {});
          expect(wrapper.text()).toContain('Welcome to Hello');
        });
      });
      "
    `);
  });

  it('should have correct component name based on directory', async () => {
    await componentGenerator(appTree, {
      name: 'hello-world',
      project: libName,
      directory: 'foo/bar',
    });

    expect(
      appTree.read(
        `${libName}/src/foo/bar/hello-world/hello-world.vue`,
        'utf-8'
      )
    ).toContain('HelloWorld');
  });

  it('should not append Component if component name is two words - camelCase', async () => {
    await componentGenerator(appTree, {
      name: 'helloWorld',
      project: libName,
      directory: 'foo/bar-baz',
    });

    expect(
      appTree.read(
        `${libName}/src/foo/bar-baz/hello-world/hello-world.vue`,
        'utf-8'
      )
    ).toContain('HelloWorld');
  });

  it('should generate files for an app', async () => {
    await componentGenerator(appTree, {
      name: 'hello',
      project: appName,
    });

    expect(
      appTree.read(`${appName}/src/app/hello/hello.vue`, 'utf-8')
    ).toContain('Hello');
    expect(
      appTree.exists(`${appName}/src/app/hello/hello.spec.ts`)
    ).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: libName,
        export: true,
      });
      expect(appTree.read(`${libName}/src/index.ts`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "export { default as Hello } from './lib/hello/hello.vue';
        "
      `);
    });

    it('should not export from an app', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: appName,
        export: true,
      });

      expect(appTree.exists(`${appName}/src/index.ts`)).toBe(false);
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate component files with upper case names', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: libName,
        pascalCaseFiles: true,
        directory: 'foo/bar',
      });
      expect(
        appTree.read(`${libName}/src/foo/bar/hello/Hello.vue`, 'utf-8')
      ).toContain('Hello');
      expect(
        appTree.exists(`${libName}/src/foo/bar/hello/Hello.spec.ts`)
      ).toBeTruthy();
    });
  });

  describe('--pascalCaseDirectory', () => {
    it('should generate component files with pascal case directories', async () => {
      await componentGenerator(appTree, {
        name: 'hello-world',
        project: libName,
        pascalCaseFiles: true,
        pascalCaseDirectory: true,
      });
      expect(
        appTree.exists(`${libName}/src/lib/HelloWorld/HelloWorld.vue`)
      ).toBeTruthy();
      expect(
        appTree.exists(`${libName}/src/lib/HelloWorld/HelloWorld.spec.ts`)
      ).toBeTruthy();
    });
  });

  describe('--flat', () => {
    it('should create in project directory rather than in its own folder', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: libName,
        flat: true,
      });

      expect(appTree.exists(`${libName}/src/lib/hello.vue`));
    });
    it('should work with custom directory path', async () => {
      await componentGenerator(appTree, {
        name: 'hello',
        project: libName,
        flat: true,
        directory: 'components',
      });

      expect(appTree.exists(`${libName}/src/components/hello.vue`));
    });
  });
});
