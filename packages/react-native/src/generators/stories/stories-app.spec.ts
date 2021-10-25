import { Tree } from '@nrwl/devkit';
import storiesGenerator from './stories';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import applicationGenerator from '../application/application';
import { Linter } from '@nrwl/linter';
import { reactNativeComponentGenerator } from '../component/component';

describe('react:stories for applications', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUIApp('test-ui-app');
    await reactNativeComponentGenerator(appTree, {
      name: 'test',
      project: 'test-ui-app',
    });
  });

  it('should create the stories', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    expect(
      appTree.exists('apps/test-ui-app/src/app/app.stories.tsx')
    ).toBeTruthy();
    expect(
      appTree.exists(
        'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
      )
    ).toBeTruthy();
  });

  it('should ignore files that do not contain components', async () => {
    // create another component
    appTree.write(
      'apps/test-ui-app/src/app/some-utils.js',
      `export const add = (a: number, b: number) => a + b;`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(
      appTree.exists('apps/test-ui-app/src/app/app.stories.tsx')
    ).toBeTruthy();
  });
});

export async function createTestUIApp(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await applicationGenerator(appTree, {
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
  });
  return appTree;
}
