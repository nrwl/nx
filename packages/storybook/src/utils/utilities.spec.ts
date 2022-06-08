import { joinPathFragments, Tree, writeJson } from '@nrwl/devkit';
import {
  overrideCollectionResolutionForTesting,
  wrapAngularDevkitSchematic,
} from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { isTheFileAStory } from './utilities';
import { nxVersion, storybookVersion } from './versions';

const componentSchematic = wrapAngularDevkitSchematic(
  '@schematics/angular',
  'component'
);
const runAngularLibrarySchematic = wrapAngularDevkitSchematic(
  '@schematics/angular',
  'library'
);
const runAngularStorybookSchematic = wrapAngularDevkitSchematic(
  '@nrwl/angular',
  'storybook-configuration'
);

describe('testing utilities', () => {
  let appTree: Tree;

  beforeEach(async () => {
    overrideCollectionResolutionForTesting({
      '@nrwl/storybook': joinPathFragments(
        __dirname,
        '../../../../generators.json'
      ),
    });

    appTree = createTreeWithEmptyWorkspace();

    await runAngularLibrarySchematic(appTree, {
      name: 'test-ui-lib',
    });

    await componentSchematic(appTree, {
      name: 'button',
      project: 'test-ui-lib',
    });

    writeJson(appTree, 'package.json', {
      devDependencies: {
        '@nrwl/storybook': nxVersion,
        '@storybook/addon-knobs': storybookVersion,
        '@storybook/angular': storybookVersion,
      },
    });
    writeJson(appTree, 'test-ui-lib/tsconfig.json', {});

    await runAngularStorybookSchematic(appTree, {
      name: 'test-ui-lib',
      configureCypress: true,
    });

    appTree.write(
      `test-ui-lib/src/lib/button/button.component.stories.ts`,
      `
      import { Story, Meta } from '@storybook/react';
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
      `test-ui-lib/src/lib/button/button.component.other.ts`,
      `
        import { Button } from './button';
        
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
       import { ComponentStory } from '@storybook/react';
        
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
