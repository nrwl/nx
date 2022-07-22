import { Tree } from '@nrwl/devkit';
import storiesGenerator from './stories';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import applicationGenerator from '../application/application';
import { Linter } from '@nrwl/linter';
import libraryGenerator from '../library/library';

describe('react:stories for libraries', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib');

    // create another component
    appTree.write(
      'libs/test-ui-lib/src/lib/anothercmp/another-cmp.tsx',
      `import React from 'react';

      import './test.scss';

      export interface TestProps {
        name: string;
        displayAge: boolean;
      }

      export const Test = (props: TestProps) => {
        return (
          <div>
            <h1>Welcome to test component, {props.name}</h1>
          </div>
        );
      };

      export default Test;
      `
    );
  });

  it('should create the stories', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-lib',
      generateCypressSpecs: false,
    });

    expect(
      appTree.exists('libs/test-ui-lib/src/lib/test-ui-lib.stories.tsx')
    ).toBeTruthy();
    expect(
      appTree.exists(
        'libs/test-ui-lib/src/lib/anothercmp/another-cmp.stories.tsx'
      )
    ).toBeTruthy();
  });

  it('should generate Cypress specs', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-lib',
      generateCypressSpecs: true,
    });

    expect(
      appTree.exists(
        'apps/test-ui-lib-e2e/src/integration/test-ui-lib/test-ui-lib.spec.ts'
      )
    ).toBeTruthy();
    expect(
      appTree.exists(
        'apps/test-ui-lib-e2e/src/integration/another-cmp/another-cmp.spec.ts'
      )
    ).toBeTruthy();
  });

  it('should not overwrite existing stories', () => {});

  it('should ignore files that do not contain components', async () => {
    // create another component
    appTree.write(
      'libs/test-ui-lib/src/lib/some-utils.js',
      `export const add = (a: number, b: number) => a + b;`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-lib',
      generateCypressSpecs: false,
    });

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(
      appTree.exists('libs/test-ui-lib/src/lib/test-ui-lib.stories.tsx')
    ).toBeTruthy();
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
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    standaloneConfig: false,
  });

  // create some Nx app that we'll use to generate the cypress
  // spec into it. We don't need a real Cypress setup

  await applicationGenerator(appTree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: `${libName}-e2e`,
    js: plainJS,
    standaloneConfig: false,
  });
  return appTree;
}
