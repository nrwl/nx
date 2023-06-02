import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import componentStoryGenerator from './component-story';
import { Linter } from '@nx/linter';

import { formatFile } from '../../utils/format-file';
import libraryGenerator from '../library/library';
import componentGenerator from '../component/component';

describe('react-native:component-story', () => {
  let appTree: Tree;
  let cmpPath = 'libs/test-ui-lib/src/lib/test-ui-lib/test-ui-lib.tsx';
  let storyFilePath =
    'libs/test-ui-lib/src/lib/test-ui-lib/test-ui-lib.stories.tsx';

  describe('default setup', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib');
    });

    describe('when file does not contain a component', () => {
      beforeEach(() => {
        appTree.write(
          cmpPath,
          `export const add = (a: number, b: number) => a + b;`
        );
      });

      it('should fail with a descriptive error message', async () => {
        try {
          await componentStoryGenerator(appTree, {
            componentPath: 'lib/test-ui-lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          });
        } catch (e) {
          expect(e.message).toContain(
            'Could not find any React Native component in file libs/test-ui-lib/src/lib/test-ui-lib/test-ui-lib.tsx'
          );
        }
      });
    });

    describe('default component setup', () => {
      beforeEach(async () => {
        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should create the story file', () => {
        expect(appTree.exists(storyFilePath)).toBeTruthy();
      });

      it('should properly set up the story', () => {
        expect(
          formatFile`${appTree.read(storyFilePath, 'utf-8').replace('·', '')}`
        ).toContain(formatFile`
        import type { Meta } from '@storybook/react-native';
        import { TestUiLib } from './test-ui-lib';
        const Story: Meta<typeof TestUiLib> = {
          component: TestUiLib,
          title: 'TestUiLib',
        };
        export default Story;
        export const Primary = { args: {} };
          `);
      });
    });

    describe('when using plain JS components', () => {
      let storyFilePathPlain =
        'libs/test-ui-lib/src/lib/test-ui-libplain.stories.jsx';

      beforeEach(async () => {
        appTree.write(
          'libs/test-ui-lib/src/lib/test-ui-libplain.jsx',
          `import React from 'react';
  
          import './test.scss';
          
          export const Test = () => {
            return (
              <div>
                <h1>Welcome to test component</h1>
              </div>
            );
          };
          
          export default Test;        
          `
        );

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-libplain.jsx',
          project: 'test-ui-lib',
        });
      });

      it('should create the story file', () => {
        expect(appTree.exists(storyFilePathPlain)).toBeTruthy();
      });

      it('should properly set up the story', () => {
        expect(formatFile`${appTree.read(storyFilePathPlain, 'utf-8')}`)
          .toContain(formatFile`
          import Test from './test-ui-libplain';
          export default { component: Test, title: 'Test' };
          export const Primary = { args: {} };
          `);
      });
    });

    describe('component without any props defined', () => {
      beforeEach(async () => {
        appTree.write(
          cmpPath,
          `import React from 'react';

          import { View, Text } from 'react-native';
          
          export function Test() {
            return (
              <View>
                <Text>Welcome to test!</Text>
              </View>
            );
          }
          
          export default Test;   
          `
        );
        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should create a story without controls', () => {
        expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
          .toContain(formatFile`
          import type { Meta } from '@storybook/react-native';
          import { Test } from './test-ui-lib';
          const Story: Meta<typeof Test> = { component: Test, title: 'Test' };
          export default Story;
          export const Primary = { args: {} };
          `);
      });
    });

    describe('component with props', () => {
      beforeEach(async () => {
        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should setup controls based on the component props', () => {
        expect(
          formatFile`${appTree.read(storyFilePath, 'utf-8').replace('·', '')}`
        ).toContain(formatFile`
        import type { Meta } from '@storybook/react-native';
        import { TestUiLib } from './test-ui-lib';
        const Story: Meta<typeof TestUiLib> = {
          component: TestUiLib,
          title: 'TestUiLib',
        };
        export default Story;
        export const Primary = { args: {} };
          `);
      });
    });

    describe('component with props and actions', () => {
      beforeEach(async () => {
        appTree.write(
          cmpPath,
          `import React from 'react';

          export type ButtonStyle = 'default' | 'primary' | 'warning';
          
          export interface TestProps {
            name: string;
            displayAge: boolean;
            someAction: (e: unknown) => void;
            style: ButtonStyle;
          }
          
          export const Test = (props: TestProps) => {
            return (
              <div>
                <h1>Welcome to test component, {props.name}</h1>
                <button onClick={props.someAction}>Click me!</button>
              </div>
            );
          };
          
          export default Test;        
          `
        );

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should setup controls based on the component props', () => {
        expect(
          formatFile`${appTree.read(storyFilePath, 'utf-8').replace('·', '')}`
        ).toContain(formatFile`
        import type { Meta } from '@storybook/react-native';
        import { Test } from './test-ui-lib';
        const Story: Meta<typeof Test> = {
          component: Test,
          title: 'Test',
          argTypes: { someAction: { action: 'someAction executed!' } },
        };
        export default Story;
        export const Primary = { args: { name: '', displayAge: false } };
          `);
      });
    });

    [
      {
        name: 'default export function',
        src: `export default function Test(props: TestProps) {
        return (
          <div>
            <h1>Welcome to test component, {props.name}</h1>
          </div>
        );
      };
      `,
      },
      {
        name: 'function and then export',
        src: `
      function Test(props: TestProps) {
        return (
          <div>
            <h1>Welcome to test component, {props.name}</h1>
          </div>
        );
      };
      export default Test;
      `,
      },
      {
        name: 'arrow function',
        src: `
      const Test = (props: TestProps) => {
        return (
          <div>
            <h1>Welcome to test component, {props.name}</h1>
          </div>
        );
      };
      export default Test;
      `,
      },
      {
        name: 'arrow function without {..}',
        src: `
      const Test = (props: TestProps) => <div><h1>Welcome to test component, {props.name}</h1></div>;
      export default Test
      `,
      },
      {
        name: 'direct export of component class',
        src: `
        export default class Test extends React.Component<TestProps> {
          render() {
            return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
          }
        }
        `,
      },
      {
        name: 'component class & then default export',
        src: `
        class Test extends React.Component<TestProps> {
          render() {
            return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
          }
        }
        export default Test
        `,
      },
      {
        name: 'PureComponent class & then default export',
        src: `
        class Test extends React.PureComponent<TestProps> {
          render() {
            return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
          }
        }
        export default Test
        `,
      },
      {
        name: 'direct export of component class new JSX transform',
        src: `
        export default class Test extends Component<TestProps> {
          render() {
            return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
          }
        }
        `,
      },
      {
        name: 'component class & then default export new JSX transform',
        src: `
        class Test extends Component<TestProps> {
          render() {
            return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
          }
        }
        export default Test
        `,
      },
      {
        name: 'PureComponent class & then default export new JSX transform',
        src: `
        class Test extends PureComponent<TestProps> {
          render() {
            return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
          }
        }
        export default Test
        `,
      },
    ].forEach((config) => {
      describe(`React Native component defined as:${config.name}`, () => {
        beforeEach(async () => {
          appTree.write(
            cmpPath,
            `import React from 'react';
            
            export interface TestProps {
              name: string;
              displayAge: boolean;
            }
            
            ${config.src}
            `
          );

          await componentStoryGenerator(appTree, {
            componentPath: 'lib/test-ui-lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          });
        });

        it('should properly setup the controls based on the component props', () => {
          expect(
            formatFile`${appTree.read(storyFilePath, 'utf-8').replace('·', '')}`
          ).toContain(formatFile`
    import type { Meta } from '@storybook/react-native';
    import { Test } from './test-ui-lib';
    const Story: Meta<typeof Test> = { component: Test, title: 'Test' };
    export default Story;
    export const Primary = { args: { name: '', displayAge: false } };
          `);
        });
      });
    });
  });

  describe('using eslint', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib');
      await componentGenerator(appTree, {
        name: 'test-ui-lib',
        project: 'test-ui-lib',
        export: true,
      });
      await componentStoryGenerator(appTree, {
        componentPath: 'lib/test-ui-lib/test-ui-lib.tsx',
        project: 'test-ui-lib',
      });
    });

    it('should properly set up the story', () => {
      expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
        .toContain(formatFile`
    import type { Meta } from '@storybook/react-native';
    import { TestUiLib } from './test-ui-lib';
    const Story: Meta<typeof TestUiLib> = {
      component: TestUiLib,
      title: 'TestUiLib',
    };
    export default Story;
    export const Primary = { args: {} };
        `);
    });
  });
});

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  appTree.write('.gitignore', '');

  await libraryGenerator(appTree, {
    name: libName,
    linter: Linter.EsLint,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'jest',
  });

  await componentGenerator(appTree, {
    name: libName,
    project: libName,
    export: true,
  });

  const currentWorkspaceJson = getProjects(appTree);

  const projectConfig = currentWorkspaceJson.get(libName);
  projectConfig.targets.lint.options.linter = 'eslint';

  updateProjectConfiguration(appTree, libName, projectConfig);

  return appTree;
}
