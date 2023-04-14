import { installedCypressVersion } from '@nx/cypress/src/utils/cypress-version';
import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import applicationGenerator from '../application/application';
import storiesGenerator from './stories';
// need to mock cypress otherwise it'll use the nx installed version from package.json
//  which is v9 while we are testing for the new v10 version
jest.mock('@nx/cypress/src/utils/cypress-version');
describe('react:stories for applications', () => {
  let appTree: Tree;
  let mockedInstalledCypressVersion: jest.Mock<
    ReturnType<typeof installedCypressVersion>
  > = installedCypressVersion as never;
  beforeEach(async () => {
    mockedInstalledCypressVersion.mockReturnValue(10);
    appTree = await createTestUIApp('test-ui-app');

    // create another component
    appTree.write(
      'apps/test-ui-app/src/app/anothercmp/another-cmp.tsx',
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
      project: 'test-ui-app',
      generateCypressSpecs: false,
    });

    expect(
      appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
    ).toBeTruthy();
    expect(
      appTree.exists(
        'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
      )
    ).toBeTruthy();
  });

  it('should generate Cypress specs', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      generateCypressSpecs: true,
    });

    expect(
      appTree.exists('apps/test-ui-app-e2e/src/e2e/app.cy.ts')
    ).toBeTruthy();
    expect(
      appTree.exists(
        'apps/test-ui-app-e2e/src/e2e/another-cmp/another-cmp.cy.ts'
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
      generateCypressSpecs: false,
    });

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(
      appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
    ).toBeTruthy();
  });

  it('should not update existing stories', async () => {
    // ARRANGE
    appTree.write(
      'apps/test-ui-app/src/app/nx-welcome.stories.tsx',
      `import { ComponentStory, ComponentMeta } from '@storybook/react'`
    );

    // ACT
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      generateCypressSpecs: false,
    });

    // ASSERT
    expect(
      appTree.read('apps/test-ui-app/src/app/nx-welcome.stories.tsx', 'utf-8')
    ).toEqual(
      `import { ComponentStory, ComponentMeta } from '@storybook/react';\n`
    );
  });

  describe('ignore paths', () => {
    beforeEach(() => {
      appTree.write(
        'apps/test-ui-app/src/app/test-path/ignore-it/another-one.tsx',
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

      appTree.write(
        'apps/test-ui-app/src/app/anothercmp/another-cmp-test.skip.tsx',
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
    it('should generate stories for all if no ignorePaths', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        generateCypressSpecs: false,
      });

      expect(
        appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeTruthy();
    });

    it('should ignore entire paths', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        generateCypressSpecs: false,
        ignorePaths: [
          `apps/test-ui-app/src/app/anothercmp/**`,
          `**/**/src/**/test-path/ignore-it/**`,
        ],
      });

      expect(
        appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });

    it('should ignore path or a pattern', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        generateCypressSpecs: false,
        ignorePaths: [
          'apps/test-ui-app/src/app/anothercmp/**/*.skip.*',
          '**/**/src/**/test-path/**',
        ],
      });

      expect(
        appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });

    it('should ignore direct path to component', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        generateCypressSpecs: false,
        ignorePaths: ['apps/test-ui-app/src/app/anothercmp/**/*.skip.tsx'],
      });

      expect(
        appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });

    it('should ignore a path that has a nested component, but still generate nested component stories', async () => {
      appTree.write(
        'apps/test-ui-app/src/app/anothercmp/comp-a/comp-a.tsx',
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

      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        generateCypressSpecs: false,
        ignorePaths: [
          'apps/test-ui-app/src/app/anothercmp/another-cmp-test.skip.tsx',
        ],
      });

      expect(
        appTree.exists('apps/test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/comp-a/comp-a.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });
  });
});

export async function createTestUIApp(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

  await applicationGenerator(appTree, {
    e2eTestRunner: 'cypress',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    js: plainJS,
  });
  return appTree;
}
