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

      it('should fail with a descriptive error message', async () => {
        try {
          await componentStoryGenerator(appTree, {
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          });
        } catch (e) {
          expect(e.message).toContain(
            'Could not find any React component in file libs/test-ui-lib/src/lib/test-ui-lib.tsx'
          );
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
        expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
          .toContain(formatFile`
          import { ComponentStory, ComponentMeta } from '@storybook/react';
          import { TestUiLib } from './test-ui-lib';
          
          export default {
            component: TestUiLib,
            title: 'TestUiLib',
          } as ComponentMeta<typeof TestUiLib>;
          
          const Template: ComponentStory<typeof TestUiLib> = (args) => <TestUiLib {...args} />;
          
          export const Primary = Template.bind({});
          Primary.args = {};
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
          
          export default {
            component: Test,
            title: 'Test',
          };
          
          const Template = (args) => <Test {...args} />;
          
          export const Primary = Template.bind({});
          Primary.args = {};
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

      it('should create a story without controls', () => {
        expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
          .toContain(formatFile`
          import { Story, Meta } from '@storybook/react';
          import { Test } from './test-ui-lib';
          
          export default {
            component: Test,
            title: 'Test',
          } as Meta;
          
          const Template: Story = (args) => <Test {...args} />;
          
          export const Primary = Template.bind({});
          Primary.args = {};
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

      it('should setup controls based on the component props', () => {
        expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
          .toContain(formatFile`
            import { Story, Meta } from '@storybook/react';
            import { Test, TestProps } from './test-ui-lib';

            export default {
              component: Test,
              title: 'Test',
            } as Meta;

            const Template: Story<TestProps> = (args) => <Test {...args} />;

            export const Primary = Template.bind({});
            Primary.args = {
              name: '',
              displayAge: false,
            };
          `);
      });
    });

    describe('component with props and actions', () => {
      beforeEach(async () => {
        appTree.write(
          cmpPath,
          `import React from 'react';
  
          import './test.scss';

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
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });
      });

      it('should setup controls based on the component props', () => {
        expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
          .toContain(formatFile`
            import { Story, Meta } from '@storybook/react';
            import { Test, TestProps } from './test-ui-lib';

            export default {
              component: Test,
              title: 'Test',
              argTypes: {
                someAction: { action: 'someAction executed!' },
              },
            } as Meta;

            const Template: Story<TestProps> = (args) => <Test {...args} />;

            export const Primary = Template.bind({});
            Primary.args = {
              name: '',
              displayAge: false,
            };
          `);
      });
    });

    describe('Other types of component definitions', () => {
      describe('Component files with DEFAULT export', () => {
        const reactComponentDefinitions = [
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
        ];

        describe.each(reactComponentDefinitions)(
          'React component defined as: $name',
          ({ src }) => {
            beforeEach(async () => {
              appTree.write(
                cmpPath,
                `import React from 'react';
    
            import './test.scss';
            
            export interface TestProps {
              name: string;
              displayAge: boolean;
            }
            
            ${src}
            `
              );

              await componentStoryGenerator(appTree, {
                componentPath: 'lib/test-ui-lib.tsx',
                project: 'test-ui-lib',
              });
            });

            it('should properly setup the controls based on the component props', () => {
              expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
                .toContain(formatFile`
            import { Story, Meta } from '@storybook/react';
            import { Test, TestProps } from './test-ui-lib';

            export default {
              component: Test,
              title: 'Test',
            } as Meta;

            const Template: Story<TestProps> = (args) => <Test {...args} />;

            export const Primary = Template.bind({});
            Primary.args = {
              name: '',
              displayAge: false,
            };
          `);
            });
          }
        );
      });

      describe('Component files with NO DEFAULT export', () => {
        const noDefaultExportComponents = [
          {
            name: 'no default simple export function',
            src: `export function Test(props: TestProps) {
          return (
            <div>
              <h1>Welcome to test component, {props.name}</h1>
            </div>
          );
        };
        `,
          },
          {
            name: 'no default arrow function',
            src: `
            export const Test = (props: TestProps) => {
          return (
            <div>
              <h1>Welcome to test component, {props.name}</h1>
            </div>
          );
        };
        `,
          },
          {
            name: 'no default arrow function without {..}',
            src: `
            export const Test = (props: TestProps) => <div><h1>Welcome to test component, {props.name}</h1></div>;
        `,
          },
          {
            name: 'no default direct export of component class',
            src: `
          export class Test extends React.Component<TestProps> {
            render() {
              return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
            }
          }
          `,
          },
          {
            name: 'no default component class',
            src: `
            export class Test extends React.Component<TestProps> {
            render() {
              return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
            }
          }
          `,
          },
          {
            name: 'no default PureComponent class & then default export',
            src: `
            export class Test extends React.PureComponent<TestProps> {
            render() {
              return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
            }
          }
          `,
          },
          {
            name: 'no default direct export of component class new JSX transform',
            src: `
          export class Test extends Component<TestProps> {
            render() {
              return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
            }
          }
          `,
          },
          {
            name: 'no default PureComponent class & then default export new JSX transform',
            src: `
            export class Test extends PureComponent<TestProps> {
            render() {
              return <div><h1>Welcome to test component, {this.props.name}</h1></div>;
            }
          }
          `,
          },
        ];

        describe.each(noDefaultExportComponents)(
          'React component defined as: $name',
          ({ src }) => {
            beforeEach(async () => {
              appTree.write(
                cmpPath,
                `import React from 'react';
      
              import './test.scss';
              
              export interface TestProps {
                name: string;
                displayAge: boolean;
              }
              
              ${src}
              `
              );

              await componentStoryGenerator(appTree, {
                componentPath: 'lib/test-ui-lib.tsx',
                project: 'test-ui-lib',
              });
            });

            it('should properly setup the controls based on the component props', () => {
              expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
                .toContain(formatFile`
              import { Story, Meta } from '@storybook/react';
              import { Test, TestProps } from './test-ui-lib';
  
              export default {
                component: Test,
                title: 'Test',
              } as Meta;
  
              const Template: Story<TestProps> = (args) => <Test {...args} />;
  
              export const Primary = Template.bind({});
              Primary.args = {
                name: '',
                displayAge: false,
              };
            `);
            });
          }
        );

        it('should create stories for all components in a file with no default export', async () => {
          appTree.write(
            cmpPath,
            `import React from 'react';
  
            function One() {
              return <div>Hello one</div>;
            }
            
            function Two() {
              return <div>Hello two</div>;
            }
            
            export interface ThreeProps {
              name: string;
            }           
    
            function Three(props: ThreeProps) {
              return (
                <div>
                  <h1>Welcome to Three {props.name}!</h1>
                </div>
              );
            }
            
            export { One, Two, Three };    
            `
          );

          await componentStoryGenerator(appTree, {
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
          });

          const storyFilePathOne =
            'libs/test-ui-lib/src/lib/test-ui-lib--One.stories.tsx';
          const storyFilePathTwo =
            'libs/test-ui-lib/src/lib/test-ui-lib--Two.stories.tsx';
          const storyFilePathThree =
            'libs/test-ui-lib/src/lib/test-ui-lib--Three.stories.tsx';

          expect(formatFile`${appTree.read(storyFilePathOne, 'utf-8')}`)
            .toContain(formatFile`
            import { Story, Meta } from '@storybook/react';
            import { One } from './test-ui-lib';
            
            export default {
              component: One,
              title: 'One',
            } as Meta;
            
            const Template: Story = (args) => <One {...args} />;
            
            export const Primary = Template.bind({});
            Primary.args = {};
            `);

          expect(formatFile`${appTree.read(storyFilePathTwo, 'utf-8')}`)
            .toContain(formatFile`
            import { Story, Meta } from '@storybook/react';
            import { Two } from './test-ui-lib';
            
            export default {
              component: Two,
              title: 'Two',
            } as Meta;
            
            const Template: Story = (args) => <Two {...args} />;
            
            export const Primary = Template.bind({});
            Primary.args = {};
            `);

          expect(formatFile`${appTree.read(storyFilePathThree, 'utf-8')}`)
            .toContain(formatFile`
            import { Story, Meta } from '@storybook/react';
            import { Three, ThreeProps } from './test-ui-lib';
            
            export default {
              component: Three,
              title: 'Three',
            } as Meta;
            
            const Template: Story<ThreeProps> = (args) => <Three {...args} />;
            
            export const Primary = Template.bind({});
            Primary.args = {
              name: '',
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
      expect(formatFile`${appTree.read(storyFilePath, 'utf-8')}`)
        .toContain(formatFile`
        import { Story, Meta } from '@storybook/react';
        import { TestUiLib, TestUiLibProps } from './test-ui-lib';
        
        export default {
          component: TestUiLib,
          title: 'TestUiLib',
        } as Meta;
        
        const Template: Story<TestUiLibProps> = (args) => <TestUiLib {...args} />;
        
        export const Primary = Template.bind({});
        Primary.args = {};
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
    standaloneConfig: false,
  });

  if (useEsLint) {
    const currentWorkspaceJson = getProjects(appTree);

    const projectConfig = currentWorkspaceJson.get(libName);
    projectConfig.targets.lint.options.linter = 'eslint';

    updateProjectConfiguration(appTree, libName, projectConfig);
  }

  return appTree;
}
