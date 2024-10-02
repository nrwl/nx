import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import applicationGenerator from '../application/application';
import storiesGenerator from './stories';

const componentContent = `<script setup lang="ts">
defineProps<{
  name: string;
  displayAge: boolean;
  age: number;
}>();
</script>

<template>
  <p>Welcome to Vlv!</p>
</template>

<style scoped>
</style>
`;

describe('vue:stories for applications', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUIApp('test-ui-app');

    // create another component
    appTree.write(
      'test-ui-app/src/app/another-cmp/another-cmp.vue',
      componentContent
    );
  });

  it('should create the stories with interaction tests', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    expect(
      appTree.read('test-ui-app/src/app/NxWelcome.stories.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'test-ui-app/src/app/another-cmp/another-cmp.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should create the stories without interaction tests', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      interactionTests: false,
    });

    expect(
      appTree.read('test-ui-app/src/app/NxWelcome.stories.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'test-ui-app/src/app/another-cmp/another-cmp.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should not update existing stories', async () => {
    appTree.write(
      'test-ui-app/src/app/NxWelcome.stories.ts',
      `import { ComponentStory, ComponentMeta } from '@storybook/vue3'`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    expect(
      appTree.read('test-ui-app/src/app/NxWelcome.stories.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  describe('ignore paths', () => {
    beforeEach(() => {
      appTree.write(
        'test-ui-app/src/app/test-path/ignore-it/another-one.vue',
        componentContent
      );

      appTree.write(
        'test-ui-app/src/app/another-cmp/another-cmp-test.skip.vue',
        componentContent
      );
    });
    it('should generate stories for all if no ignorePaths', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
      });

      expect(
        appTree.exists('test-ui-app/src/app/NxWelcome.stories.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/another-cmp/another-cmp.stories.ts')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.ts'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/another-cmp/another-cmp-test.skip.stories.ts'
        )
      ).toBeTruthy();
    });

    it('should ignore entire paths', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        ignorePaths: [
          `test-ui-app/src/app/another-cmp/**`,
          `**/**/src/**/test-path/ignore-it/**`,
        ],
      });

      expect(
        appTree.exists('test-ui-app/src/app/NxWelcome.stories.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/another-cmp/another-cmp.stories.ts')
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.ts'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/another-cmp/another-cmp-test.skip.stories.ts'
        )
      ).toBeFalsy();
    });

    it('should ignore path or a pattern', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        ignorePaths: [
          'test-ui-app/src/app/another-cmp/**/*.skip.*',
          '**/**/src/**/test-path/**',
        ],
      });

      expect(
        appTree.exists('test-ui-app/src/app/NxWelcome.stories.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/another-cmp/another-cmp.stories.ts')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.ts'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/another-cmp/another-cmp-test.skip.stories.ts'
        )
      ).toBeFalsy();
    });

    it('should ignore direct path to component', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        ignorePaths: ['test-ui-app/src/app/another-cmp/**/*.skip.vue'],
      });

      expect(
        appTree.exists('test-ui-app/src/app/NxWelcome.stories.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/another-cmp/another-cmp.stories.ts')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.ts'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/another-cmp/another-cmp-test.skip.stories.ts'
        )
      ).toBeFalsy();
    });

    it('should ignore a path that has a nested component, but still generate nested component stories', async () => {
      appTree.write(
        'test-ui-app/src/app/another-cmp/comp-a/comp-a.vue',
        componentContent
      );

      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        ignorePaths: [
          'test-ui-app/src/app/another-cmp/another-cmp-test.skip.vue',
        ],
      });

      expect(
        appTree.exists('test-ui-app/src/app/NxWelcome.stories.ts')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/another-cmp/another-cmp.stories.ts')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/another-cmp/comp-a/comp-a.stories.ts'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/another-cmp/another-cmp-test.skip.stories.ts'
        )
      ).toBeFalsy();
    });
  });
});

export async function createTestUIApp(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await applicationGenerator(appTree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    directory: libName,
    js: plainJS,
  });
  return appTree;
}
