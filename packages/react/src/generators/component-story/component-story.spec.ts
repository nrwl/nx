import { getProjects, Tree, updateProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import libraryGenerator from '../library/library';
import componentStoryGenerator from './component-story';
import { Linter } from '@nrwl/linter';
import { formatFile } from '../../utils/format-file';

describe('react:component-story', () => {
  let appTree: Tree;
  let cmpPath = 'libs/test-ui-lib/src/lib/test-ui-lib.tsx';
  let storyFilePath = 'libs/test-ui-lib/src/lib/test-ui-lib.stories.tsx';

  describe('default setup', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib', true);
    });

    describe('when file does not contain a component', () => {
      beforeEach(() => {
        appTree.write(
          cmpPath,
          `export const add = (a: number, b: number) => a + b;`
        );
      });

      it('should fail with a descriptive error message', async (done) => {
        try {
          await componentStoryGenerator(appTree, {
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          });
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
        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should create the story file', () => {
        expect(appTree.exists(storyFilePath)).toBeTruthy();
      });

      it('should properly set up the story', () => {
        expect(formatFile`${appTree.read(storyFilePath).toString()}`)
          .toContain(formatFile`
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
        expect(formatFile`${appTree.read(storyFilePathPlain).toString()}`)
          .toContain(formatFile`
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
        appTree.write(
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

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should create a story without knobs', () => {
        expect(formatFile`${appTree.read(storyFilePath).toString()}`)
          .toContain(formatFile`
            import React from 'react';
            import { Test } from './test-ui-lib';
            
            export default {
              component: Test,
              title: 'Test',
            };
            
            export const primary = () => {
              return <Test />;
            }
          `);
      });
    });

    describe('component with props', () => {
      beforeEach(async () => {
        appTree.write(
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

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should setup knobs based on the component props', () => {
        expect(formatFile`${appTree.read(storyFilePath).toString()}`)
          .toContain(formatFile`
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
          appTree.write(
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

          await componentStoryGenerator(appTree, {
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          });
        });

        it('should properly setup the knobs based on the component props', () => {
          expect(formatFile`${appTree.read(storyFilePath).toString()}`)
            .toContain(formatFile`
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
      await componentStoryGenerator(appTree, {
        componentPath: 'lib/test-ui-lib.tsx',
        project: 'test-ui-lib',
      });
    });

    it('should properly set up the story', () => {
      expect(formatFile`${appTree.read(storyFilePath).toString()}`)
        .toContain(formatFile`
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
  let appTree = createTreeWithEmptyWorkspace();
  await libraryGenerator(appTree, {
    name: libName,
    linter: useEsLint ? Linter.EsLint : Linter.TsLint,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    style: 'css',
    unitTestRunner: 'jest',
  });

  if (useEsLint) {
    const currentWorkspaceJson = getProjects(appTree);

    const projectConfig = currentWorkspaceJson.get(libName);
    projectConfig.targets.lint.options.linter = 'eslint';

    updateProjectConfiguration(appTree, libName, projectConfig);
  }

  return appTree;
}
