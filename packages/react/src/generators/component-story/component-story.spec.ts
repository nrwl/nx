import { externalSchematic, Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runSchematic } from '../../utils/testing';
import { CreateComponentStoriesFileSchema } from './component-story';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

describe('react:component-story', () => {
  let appTree: Tree;
  let tree: UnitTestTree;
  let cmpPath = 'libs/test-ui-lib/src/lib/test-ui-lib.tsx';
  let storyFilePath = 'libs/test-ui-lib/src/lib/test-ui-lib.stories.tsx';

  describe('default setup', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib', true);
    });

    describe('when file does not contain a component', () => {
      beforeEach(() => {
        appTree.overwrite(
          cmpPath,
          `export const add = (a: number, b: number) => a + b;`
        );
      });

      it('should fail with a descriptive error message', async (done) => {
        try {
          tree = await runSchematic(
            'component-story',
            <CreateComponentStoriesFileSchema>{
              componentPath: 'lib/test-ui-lib.tsx',
              project: 'test-ui-lib',
            },
            appTree
          );
        } catch (e) {
          expect(e.message).toContain(
            'Could not find any React component in file libs/test-ui-lib/src/lib/test-ui-lib.tsx'
          );
          done();
        }
      });
    });

    describe('default component setup', () => {
      beforeEach(async () => {
        tree = await runSchematic(
          'component-story',
          <CreateComponentStoriesFileSchema>{
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          },
          appTree
        );
      });

      it('should create the story file', () => {
        expect(tree.exists(storyFilePath)).toBeTruthy();
      });

      it('should properly set up the story', () => {
        expect(stripIndents`${tree.readContent(storyFilePath)}`)
          .toContain(stripIndents`
            import React from 'react';
            import { TestUiLib, TestUiLibProps } from './test-ui-lib';
            
            export default {
              component: TestUiLib,
              title: 'TestUiLib',
            };
            
            export const primary = () => {
              /* eslint-disable-next-line */
              const props: TestUiLibProps = {};
            
              return <TestUiLib />;
            };
          `);
      });
    });

    describe('when using plain JS components', () => {
      let storyFilePathPlain =
        'libs/test-ui-lib/src/lib/test-ui-libplain.stories.jsx';

      beforeEach(async () => {
        appTree.create(
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

        tree = await runSchematic(
          'component-story',
          <CreateComponentStoriesFileSchema>{
            componentPath: 'lib/test-ui-libplain.jsx',
            project: 'test-ui-lib',
          },
          appTree
        );
      });

      it('should create the story file', () => {
        expect(tree.exists(storyFilePathPlain)).toBeTruthy();
      });

      it('should properly set up the story', () => {
        expect(stripIndents`${tree.readContent(storyFilePathPlain)}`)
          .toContain(stripIndents`
            import React from 'react';
            import { Test } from './test-ui-libplain';
            
            export default {
              component: Test,
              title: 'Test',
            };
            
            export const primary = () => {
              /* eslint-disable-next-line */
              const props = {};
            
              return <Test />;
            };
          `);
      });
    });

    describe('component without any props defined', () => {
      beforeEach(async () => {
        appTree.overwrite(
          cmpPath,
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

        tree = await runSchematic(
          'component-story',
          <CreateComponentStoriesFileSchema>{
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          },
          appTree
        );
      });

      it('should create a story without knobs', () => {
        expect(stripIndents`${tree.readContent(storyFilePath)}`)
          .toContain(stripIndents`
            import React from 'react';
            import { Test } from './test-ui-lib';
            
            export default {
              component: Test,
              title: 'Test',
            };
            
            export const primary = () => {
              return <Test />;
            };
          `);
      });
    });

    describe('component with props', () => {
      beforeEach(async () => {
        appTree.overwrite(
          cmpPath,
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

        tree = await runSchematic(
          'component-story',
          <CreateComponentStoriesFileSchema>{
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          },
          appTree
        );
      });

      it('should setup knobs based on the component props', () => {
        expect(stripIndents`${tree.readContent(storyFilePath)}`)
          .toContain(stripIndents`
            import { text, boolean } from '@storybook/addon-knobs';
            import React from 'react';
            import { Test, TestProps } from './test-ui-lib';
            
            export default {
              component: Test,
              title: 'Test',
            };
            
            export const primary = () => {
              const props: TestProps = {
                name: text('name', ''),
                displayAge: boolean('displayAge', false),
              };
            
              return <Test name={props.name} displayAge={props.displayAge} />;
            };
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
    ].forEach((config) => {
      describe(`React component defined as:${config.name}`, () => {
        beforeEach(async () => {
          appTree.overwrite(
            cmpPath,
            `import React from 'react';
    
            import './test.scss';
            
            export interface TestProps {
              name: string;
              displayAge: boolean;
            }
            
            ${config.src}
            `
          );

          tree = await runSchematic(
            'component-story',
            <CreateComponentStoriesFileSchema>{
              componentPath: 'lib/test-ui-lib.tsx',
              project: 'test-ui-lib',
            },
            appTree
          );
        });

        it('should properly setup the knobs based on the component props', () => {
          expect(stripIndents`${tree.readContent(storyFilePath)}`)
            .toContain(stripIndents`
            import { text, boolean } from '@storybook/addon-knobs';
            import React from 'react';
            import { Test, TestProps } from './test-ui-lib';
            
            export default {
              component: Test,
              title: 'Test',
            };
            
            export const primary = () => {
              const props: TestProps = {
                name: text('name', ''),
                displayAge: boolean('displayAge', false),
              };
            
              return <Test name={props.name} displayAge={props.displayAge} />;
            };
          `);
        });
      });
    });
  });

  describe('using eslint', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib', false);
      tree = await runSchematic(
        'component-story',
        <CreateComponentStoriesFileSchema>{
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        },
        appTree
      );
    });

    it('should properly set up the story', () => {
      expect(stripIndents`${tree.readContent(storyFilePath)}`)
        .toContain(stripIndents`
          import React from 'react';
          import { TestUiLib, TestUiLibProps } from './test-ui-lib';
          
          export default {
            component: TestUiLib,
            title: 'TestUiLib',
          };
          
          export const primary = () => {
            /* eslint-disable-next-line */
            const props: TestUiLibProps = {};
          
            return <TestUiLib />;
          };
        `);
    });
  });
});

export async function createTestUILib(
  libName: string,
  useEsLint = false
): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/react', 'library', {
      name: libName,
    }),
    appTree
  );

  if (useEsLint) {
    const currentWorkspaceJson = JSON.parse(
      appTree.read('workspace.json').toString('utf-8')
    );

    currentWorkspaceJson.projects[libName].architect.lint.options.linter =
      'eslint';

    appTree.overwrite('workspace.json', JSON.stringify(currentWorkspaceJson));
  }

  return appTree;
}
