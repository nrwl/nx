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
      path: `${libName}/src/lib/hello/hello`,
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
      path: `${libName}/src/foo/bar/hello-world/hello-world`,
    });

    expect(
      appTree.read(
        `${libName}/src/foo/bar/hello-world/hello-world.vue`,
        'utf-8'
      )
    ).toContain('HelloWorld');
  });

  it('should generate files for an app', async () => {
    await componentGenerator(appTree, {
      name: 'hello',
      path: `${appName}/src/app/hello/hello`,
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
        path: `${libName}/src/lib/hello/hello`,
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
        path: `${appName}/src/app/hello/hello`,
        export: true,
      });

      expect(appTree.exists(`${appName}/src/index.ts`)).toBe(false);
    });
  });
});
