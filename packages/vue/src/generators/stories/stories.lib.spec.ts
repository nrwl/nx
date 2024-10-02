import { Tree } from '@nx/devkit';
import storiesGenerator from './stories';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import libraryGenerator from '../library/library';

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

describe('vue:stories for libraries', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib');
    appTree.write(
      'test-ui-lib/src/lib/another-cmp/another-cmp.vue',
      componentContent
    );
  });

  it('should create the stories with interaction tests', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-lib',
    });

    expect(
      appTree.read('test-ui-lib/src/lib/test-ui-lib.stories.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'test-ui-lib/src/lib/another-cmp/another-cmp.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();

    const packageJson = JSON.parse(appTree.read('package.json', 'utf-8'));
    expect(
      packageJson.devDependencies['@storybook/addon-interactions']
    ).toBeDefined();
    expect(packageJson.devDependencies['@storybook/test-runner']).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/testing-library']
    ).toBeDefined();
  });

  it('should create the stories without interaction tests', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-lib',
      interactionTests: false,
    });
    expect(
      appTree.read('test-ui-lib/src/lib/test-ui-lib.stories.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'test-ui-lib/src/lib/another-cmp/another-cmp.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    const packageJson = JSON.parse(appTree.read('package.json', 'utf-8'));
    expect(
      packageJson.devDependencies['@storybook/addon-interactions']
    ).toBeUndefined();
    expect(
      packageJson.devDependencies['@storybook/test-runner']
    ).toBeUndefined();
    expect(
      packageJson.devDependencies['@storybook/testing-library']
    ).toBeUndefined();
  });

  describe('ignore paths', () => {
    beforeEach(() => {
      appTree.write(
        'test-ui-lib/src/lib/test-path/ignore-it/another-one.vue',
        componentContent
      );

      appTree.write(
        'test-ui-lib/src/lib/another-cmp/another-cmp.skip.vue',
        componentContent
      );
    });
    it('should generate stories for all if no ignorePaths', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-lib',
      });

      expect(
        appTree.exists('test-ui-lib/src/lib/another-cmp/another-cmp.stories.ts')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-lib/src/lib/test-path/ignore-it/another-one.stories.ts'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-lib/src/lib/another-cmp/another-cmp.skip.stories.ts'
        )
      ).toBeTruthy();
    });

    it('should ignore entire paths', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-lib',
        ignorePaths: [
          'test-ui-lib/src/lib/another-cmp/**',
          '**/**/src/**/test-path/ignore-it/**',
        ],
      });

      expect(
        appTree.exists('test-ui-lib/src/lib/another-cmp/another-cmp.stories.ts')
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-lib/src/lib/test-path/ignore-it/another-one.stories.ts'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-lib/src/lib/another-cmp/another-cmp.skip.stories.ts'
        )
      ).toBeFalsy();
    });

    it('should ignore path or a pattern', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-lib',
        ignorePaths: [
          'test-ui-lib/src/lib/another-cmp/**/*.skip.*',
          '**/test-ui-lib/src/**/test-path/**',
        ],
      });

      expect(
        appTree.exists('test-ui-lib/src/lib/another-cmp/another-cmp.stories.ts')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-lib/src/lib/test-path/ignore-it/another-one.stories.ts'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-lib/src/lib/another-cmp/another-cmp.skip.stories.ts'
        )
      ).toBeFalsy();
    });
  });
});

export async function createTestUILib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'none',
    directory: libName,
  });

  return appTree;
}
