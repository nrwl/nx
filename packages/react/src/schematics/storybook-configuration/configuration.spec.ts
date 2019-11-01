import { Tree, schematic, externalSchematic } from '@angular-devkit/schematics';
import { runSchematic, callRule } from '../../utils/testing';
import { StorybookConfigureSchema } from './schema';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('react:storybook-configuration', () => {
  it('should configure everything at once', async () => {
    const appTree = await createTestUILib('test-ui-lib');
    const tree = await runSchematic(
      'storybook-configuration',
      <StorybookConfigureSchema>{
        name: 'test-ui-lib',
        configureCypress: true
      },
      appTree
    );
    expect(tree.exists('libs/test-ui-lib/.storybook/addons.js')).toBeTruthy();
    expect(tree.exists('libs/test-ui-lib/.storybook/config.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
    expect(tree.exists('apps/test-ui-lib-e2e/cypress.json')).toBeTruthy();
  });
});

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'library', {
      name: libName
    }),
    appTree
  );
  return appTree;
}
