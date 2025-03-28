import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import applicationGenerator from '../application/application';
import storiesGenerator from './stories';

describe('react:stories for applications', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUIApp('test-ui-app');

    // create another component
    appTree.write(
      'test-ui-app/src/app/anothercmp/another-cmp.tsx',
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

  it('should create the stories with interaction tests', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    expect(
      appTree.read('test-ui-app/src/app/nx-welcome.stories.tsx', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'test-ui-app/src/app/anothercmp/another-cmp.stories.tsx',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should create the stories without interaction tests', async () => {
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      interactionTests: false,
    });

    expect(
      appTree.read('test-ui-app/src/app/nx-welcome.stories.tsx', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read(
        'test-ui-app/src/app/anothercmp/another-cmp.stories.tsx',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should ignore files that do not contain components', async () => {
    // create another component
    appTree.write(
      'test-ui-app/src/app/some-utils.js',
      `export const add = (a: number, b: number) => a + b;`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(
      appTree.exists('test-ui-app/src/app/nx-welcome.stories.tsx')
    ).toBeTruthy();
  });

  it('should not update existing stories', async () => {
    appTree.write(
      'test-ui-app/src/app/nx-welcome.stories.tsx',
      `import { ComponentStory, ComponentMeta } from '@storybook/react'`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    expect(
      appTree.read('test-ui-app/src/app/nx-welcome.stories.tsx', 'utf-8')
    ).toMatchSnapshot();
  });

  describe('ignore paths', () => {
    beforeEach(() => {
      appTree.write(
        'test-ui-app/src/app/test-path/ignore-it/another-one.tsx',
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
        'test-ui-app/src/app/anothercmp/another-cmp-test.skip.tsx',
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
      });

      expect(
        appTree.exists('test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/anothercmp/another-cmp.stories.tsx')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeTruthy();
    });

    it('should ignore entire paths', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        ignorePaths: [
          `test-ui-app/src/app/anothercmp/**`,
          `**/**/src/**/test-path/ignore-it/**`,
        ],
      });

      expect(
        appTree.exists('test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/anothercmp/another-cmp.stories.tsx')
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });

    it('should ignore path or a pattern', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        ignorePaths: [
          'test-ui-app/src/app/anothercmp/**/*.skip.*',
          '**/**/src/**/test-path/**',
        ],
      });

      expect(
        appTree.exists('test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/anothercmp/another-cmp.stories.tsx')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeFalsy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });

    it('should ignore direct path to component', async () => {
      await storiesGenerator(appTree, {
        project: 'test-ui-app',
        ignorePaths: ['test-ui-app/src/app/anothercmp/**/*.skip.tsx'],
      });

      expect(
        appTree.exists('test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/anothercmp/another-cmp.stories.tsx')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/test-path/ignore-it/another-one.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });

    it('should ignore a path that has a nested component, but still generate nested component stories', async () => {
      appTree.write(
        'test-ui-app/src/app/anothercmp/comp-a/comp-a.tsx',
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
        ignorePaths: [
          'test-ui-app/src/app/anothercmp/another-cmp-test.skip.tsx',
        ],
      });

      expect(
        appTree.exists('test-ui-app/src/app/nx-welcome.stories.tsx')
      ).toBeTruthy();
      expect(
        appTree.exists('test-ui-app/src/app/anothercmp/another-cmp.stories.tsx')
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/anothercmp/comp-a/comp-a.stories.tsx'
        )
      ).toBeTruthy();

      expect(
        appTree.exists(
          'test-ui-app/src/app/anothercmp/another-cmp-test.skip.stories.tsx'
        )
      ).toBeFalsy();
    });
  });
});

export async function createTestUIApp(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await applicationGenerator(appTree, {
    e2eTestRunner: 'cypress',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    directory: libName,
    js: plainJS,
  });
  return appTree;
}
