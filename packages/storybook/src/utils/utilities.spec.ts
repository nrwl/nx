import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  findStorybookAndBuildTargetsAndCompiler,
  isTheFileAStory,
  getStorybookVersionToInstall,
} from './utilities';
import * as targetVariations from './test-configs/different-target-variations.json';

describe('testing utilities', () => {
  describe('Test functions that need workspace tree', () => {
    let appTree: Tree;

    beforeEach(async () => {
      appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

      appTree.write(
        `test-ui-lib/src/lib/button/button.component.stories.ts`,
        `
      import { Story, Meta } from '@storybook/react-webpack5';
      import { Button } from './button';

      export default {
        component: Button,
        title: 'Button',
      } as Meta;

      const Template: Story = (args) => <Button {...args} />;

      export const Primary = Template.bind({});
      Primary.args = {};
    `
      );

      appTree.write(
        `test-ui-lib/src/lib/button/button.other.stories.ts`,
        `
        import type { Meta } from '@storybook/react-webpack5';
        import { Button } from './button';

        const Story: Meta<typeof Button> = {
          component: Button,
          title: 'Layout/Texts/Button',
        };
        export default Story;

        export const Primary = {
          args: {},
        };
        `
      );

      appTree.write(
        `test-ui-lib/src/lib/button/button.component.other.ts`,
        `
        import { Button } from './button';

        // test test
      `
      );

      appTree.write(
        `test-ui-lib/src/lib/button/button.test.stories.ts`,
        `
        import { Button } from './button';
        import * as Storybook from '@storybook/react-webpack5';

        // test test
      `
      );

      appTree.write(
        `test-ui-lib/src/lib/button/button.component.react-native.ts`,
        `
       import { storiesOf } from '@storybook/react-native';

        // test test
      `
      );

      appTree.write(
        `test-ui-lib/src/lib/button/button.component.new-syntax.ts`,
        `
       import { ComponentStory } from '@storybook/react-webpack5';

        // test test
      `
      );

      appTree.write(
        `test-ui-lib/src/lib/button/button.component.stories.jsx`,
        `
       var test = 1;
        // test test
      `
      );

      appTree.write(
        `test-ui-lib/src/lib/button/button.component.stories.js`,
        `
       var test = 1;
        // test test
      `
      );
      appTree.write(
        `test-ui-lib/src/lib/button/button.component.js`,
        `
       var test = 1;
        // test test
      `
      );
      appTree.write(
        `test-ui-lib/src/lib/button/button.component.jsx`,
        `
       var test = 1;
        // test test
      `
      );
    });

    describe('typescript files', () => {
      it('should verify it is story', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.stories.ts'
        );
        expect(fileIsStory).toBeTruthy();
      });

      it('should verify it is story when using Meta', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.other.stories.ts'
        );
        expect(fileIsStory).toBeTruthy();
      });

      it('should verify it is story when using unnamed import', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.test.stories.ts'
        );
        expect(fileIsStory).toBeTruthy();
      });

      it('should verify it is story for ReactNative', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.react-native.ts'
        );
        expect(fileIsStory).toBeTruthy();
      });

      it('should verify it is story for new Syntax', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.new-syntax.ts'
        );
        expect(fileIsStory).toBeTruthy();
      });

      it('should verify it is not a story', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.other.ts'
        );
        expect(fileIsStory).toBeFalsy();
      });
    });

    describe('javascript files', () => {
      it('should verify it is story if it ends in .stories.jsx', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.stories.jsx'
        );
        expect(fileIsStory).toBeTruthy();
      });
      it('should verify it is story if it ends in .stories.js', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.stories.js'
        );
        expect(fileIsStory).toBeTruthy();
      });
      it('should verify it is NOT a story if it does NOT end in .stories.jsx', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.jsx'
        );
        expect(fileIsStory).toBeFalsy();
      });
      it('should verify it is NOT a story if it does NOT end in .stories.js', () => {
        const fileIsStory = isTheFileAStory(
          appTree,
          'test-ui-lib/src/lib/button/button.component.js'
        );
        expect(fileIsStory).toBeFalsy();
      });
    });
  });

  describe('Test pure utility functions', () => {
    describe('getStorybookVersionToInstall', () => {
      it('should return the v10 install constant when v10 is installed', () => {
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        tree.write(
          'package.json',
          JSON.stringify({
            devDependencies: {
              storybook: '^10.0.0',
            },
          })
        );
        const version = getStorybookVersionToInstall(tree);
        expect(version).toBe('^10.1.0');
      });

      it('should return the v8 install constant when v8 is installed', () => {
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        tree.write(
          'package.json',
          JSON.stringify({
            devDependencies: {
              storybook: '~8.5.3',
            },
          })
        );
        const version = getStorybookVersionToInstall(tree);
        expect(version).toBe('^8.6.11');
      });

      it('should fall through to the latest install constant when an unsupported version is installed', () => {
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        tree.write(
          'package.json',
          JSON.stringify({
            devDependencies: {
              storybook: '7.0.0',
            },
          })
        );
        const version = getStorybookVersionToInstall(tree);
        // v7 is below the floor; no version map entry — fall through to latest.
        expect(version).toBe('^10.1.0');
      });

      it('should return the v9 install constant when v9 is installed via dependencies', () => {
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        tree.write(
          'package.json',
          JSON.stringify({
            dependencies: {
              storybook: '^9.0.0',
            },
          })
        );
        const version = getStorybookVersionToInstall(tree);
        expect(version).toBe('^9.0.5');
      });
    });

    describe('findStorybookAndBuildTargetsAndCompiler', () => {
      it('should find correct targets and compiler for the provided next app config', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations.nextapp
        );
        expect(result).toEqual({
          storybookBuildTarget: undefined,
          storybookTarget: undefined,
          ngBuildTarget: undefined,
          nextBuildTarget: 'build',
          otherBuildTarget: undefined,
          compiler: undefined,
        });
      });

      it('should find correct targets and compiler for the provided web app config', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations.web
        );
        expect(result).toEqual({
          storybookBuildTarget: 'build-storybook',
          storybookTarget: 'storybook',
          ngBuildTarget: undefined,
          nextBuildTarget: 'build',
          otherBuildTarget: undefined,
          compiler: undefined,
        });
      });

      it('should find correct targets and compiler for the provided react app config', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations.react
        );
        expect(result).toEqual({
          storybookBuildTarget: 'build-storybook',
          storybookTarget: 'storybook',
          ngBuildTarget: undefined,
          nextBuildTarget: undefined,
          otherBuildTarget: 'build',
          compiler: 'babel',
        });
      });

      it('should find correct targets and compiler for the provided angular app config', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations.ngapp
        );
        expect(result).toEqual({
          storybookBuildTarget: 'build-storybook',
          storybookTarget: 'storybook',
          ngBuildTarget: 'build',
          nextBuildTarget: undefined,
          otherBuildTarget: undefined,
          compiler: undefined,
        });
      });

      it('should find correct targets and compiler for the provided angular lib config', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations.nglib
        );
        expect(result).toEqual({
          storybookBuildTarget: undefined,
          storybookTarget: undefined,
          ngBuildTarget: undefined,
          nextBuildTarget: undefined,
          otherBuildTarget: 'build',
          compiler: undefined,
        });
      });

      it('should find correct targets and compiler for the provided next lib config', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations.nextlib
        );
        expect(result).toEqual({
          storybookBuildTarget: undefined,
          storybookTarget: undefined,
          ngBuildTarget: undefined,
          nextBuildTarget: undefined,
          otherBuildTarget: 'build',
          compiler: 'babel',
        });
      });

      it('should find correct targets and compiler for the provided react app config with swc', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations['react-swc']
        );
        expect(result).toEqual({
          storybookBuildTarget: 'build-storybook',
          storybookTarget: 'storybook',
          ngBuildTarget: undefined,
          nextBuildTarget: undefined,
          otherBuildTarget: 'build',
          compiler: 'swc',
        });
      });

      it('should find correct targets and compiler for the provided Next.js app config with swc', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations['nextapp-swc']
        );
        expect(result).toEqual({
          storybookBuildTarget: undefined,
          storybookTarget: undefined,
          ngBuildTarget: undefined,
          nextBuildTarget: 'build',
          otherBuildTarget: undefined,
          compiler: 'swc',
        });
      });

      it('should find compiler for the provided config regardless of what builder', () => {
        const result = findStorybookAndBuildTargetsAndCompiler(
          targetVariations.other
        );
        expect(result).toEqual({
          storybookBuildTarget: undefined,
          storybookTarget: undefined,
          ngBuildTarget: undefined,
          nextBuildTarget: undefined,
          otherBuildTarget: 'build',
          compiler: 'swc',
        });
      });
    });
  });
});
