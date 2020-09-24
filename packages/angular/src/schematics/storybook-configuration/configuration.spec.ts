import { Tree } from '@angular-devkit/schematics';
import { runSchematic } from '../../utils/testing';
import { StorybookConfigureSchema } from './schema';
import { createTestUILib } from '../stories/stories-lib.spec';
import * as fileUtils from '@nrwl/workspace/src/core/file-utils';

describe('schematic:configuration', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib');
    jest.spyOn(fileUtils, 'readPackageJson').mockReturnValue({
      devDependencies: {
        '@storybook/addon-essentials': '^6.0.21',
        '@storybook/react': '^6.0.21',
      },
    });
  });

  it('should only configure storybook', async () => {
    const tree = await runSchematic(
      'storybook-configuration',
      <StorybookConfigureSchema>{
        name: 'test-ui-lib',
        configureCypress: false,
        generateCypressSpecs: false,
        generateStories: false,
      },
      appTree
    );
    expect(tree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeFalsy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
      )
    ).toBeFalsy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-other/test-other.component.stories.ts'
      )
    ).toBeFalsy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-button/test-button.component.spec.ts'
      )
    ).toBeFalsy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-other/test-other.component.spec.ts'
      )
    ).toBeFalsy();
  });

  it('should configure everything at once', async () => {
    const tree = await runSchematic(
      'storybook-configuration',
      <StorybookConfigureSchema>{
        name: 'test-ui-lib',
        configureCypress: true,
        generateCypressSpecs: true,
        generateStories: true,
      },
      appTree
    );
    expect(tree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeTruthy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'libs/test-ui-lib/src/lib/test-other/test-other.component.stories.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-button/test-button.component.spec.ts'
      )
    ).toBeTruthy();
    expect(
      tree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-other/test-other.component.spec.ts'
      )
    ).toBeTruthy();
  });

  it('should generate the right files', async () => {
    const tree = await runSchematic(
      'storybook-configuration',
      <StorybookConfigureSchema>{
        name: 'test-ui-lib',
        configureCypress: true,
        generateCypressSpecs: true,
        generateStories: true,
      },
      appTree
    );
    expect(tree.files).toMatchSnapshot();
  });
});
