import { Tree } from '@nrwl/devkit';
import storiesGenerator from './stories';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import applicationGenerator from '../application/application';
import { Linter } from '@nrwl/linter';
import libraryGenerator from '../library/library';
import reactNativeComponentGenerator from '../component/component';

describe('react-native:stories for libraries', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib');
  });

  it('should create the stories', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'test-ui-lib',
      project: 'test-ui-lib',
    });
    await reactNativeComponentGenerator(appTree, {
      name: 'another-cmp',
      project: 'test-ui-lib',
    });
    await storiesGenerator(appTree, {
      project: 'test-ui-lib',
    });

    expect(
      appTree.exists(
        'libs/test-ui-lib/src/lib/test-ui-lib/test-ui-lib.stories.tsx'
      )
    ).toBeTruthy();
    expect(
      appTree.exists(
        'libs/test-ui-lib/src/lib/another-cmp/another-cmp.stories.tsx'
      )
    ).toBeTruthy();
  });

  it('should ignore files that do not contain components', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'test-ui-lib',
      project: 'test-ui-lib',
    });
    // create another component
    appTree.write(
      'libs/test-ui-lib/src/lib/some-command-line-utils.ts',
      `export const add = (a: number, b: number) => a + b;`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-lib',
    });

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(
      appTree.exists(
        'libs/test-ui-lib/src/lib/test-ui-lib/test-ui-lib.stories.tsx'
      )
    ).toBeTruthy();
  });
});

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();
  appTree.write('.gitignore', '');

  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'none',
    name: libName,
  });

  await applicationGenerator(appTree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: false,
    unitTestRunner: 'none',
    name: `${libName}-e2e`,
  });
  return appTree;
}
