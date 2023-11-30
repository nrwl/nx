import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import libraryGenerator from '../../library/library';
import { createComponentStories } from './component-story';
import { Linter } from '@nx/eslint';

describe('vue:component-story', () => {
  let appTree: Tree;
  let cmpPath = 'test-ui-lib/src/lib/test-ui-lib.vue';
  let storyFilePath = 'test-ui-lib/src/lib/test-ui-lib.stories.ts';

  describe('default setup', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib');
    });

    describe('default component setup', () => {
      beforeEach(async () => {
        createComponentStories(
          appTree,
          {
            interactionTests: true,
            project: 'test-ui-lib',
          },
          'lib/test-ui-lib.vue'
        );
      });

      it('should properly set up the story', () => {
        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });
    });

    describe('component with props defined', () => {
      beforeEach(async () => {
        appTree.write(
          cmpPath,
          `<script setup lang="ts">
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
          `
        );

        createComponentStories(
          appTree,
          {
            interactionTests: true,
            project: 'test-ui-lib',
          },
          'lib/test-ui-lib.vue'
        );
      });

      it('should create a story with controls', () => {
        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });
    });

    describe('component with other syntax of props defined', () => {
      beforeEach(async () => {
        appTree.write(
          cmpPath,
          `<script>
            export default {
              name: 'HelloWorld',
              props: {
                name: string;
                displayAge: boolean;
                age: number;
              }
            }
            </script>

          <template>
            <p>Welcome to Vlv!</p>
          </template>

          <style scoped>
          </style>
          `
        );

        createComponentStories(
          appTree,
          {
            interactionTests: true,
            project: 'test-ui-lib',
          },
          'lib/test-ui-lib.vue'
        );
      });

      it('should create a story with controls', () => {
        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });
    });
  });
});

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();
  await libraryGenerator(appTree, {
    name: libName,
    linter: Linter.EsLint,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'vitest',
    projectNameAndRootFormat: 'as-provided',
  });

  const currentWorkspaceJson = getProjects(appTree);

  const projectConfig = currentWorkspaceJson.get(libName);

  updateProjectConfiguration(appTree, libName, projectConfig);

  return appTree;
}
