import { Tree, externalSchematic } from '@angular-devkit/schematics';
import { StorybookStoriesSchema } from './stories';
import {
  runSchematic,
  runExternalSchematic,
  callRule,
} from '../../utils/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('angular:stories for applications', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createAngularApp('test-app');
  });

  it('should generate stories.ts files', async () => {
    const tree = await runSchematic<StorybookStoriesSchema>(
      'stories',
      { name: 'test-app', generateCypressSpecs: false },
      appTree
    );

    expect(tree.exists('apps/test-app/src/app/app.component.ts')).toBeTruthy();
    expect(
      tree.exists('apps/test-app/src/app/app.component.stories.ts')
    ).toBeTruthy();
  });
});

export async function createAngularApp(libName: string): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/angular', 'application', {
      name: libName,
    }),
    appTree
  );
  return appTree;
}
