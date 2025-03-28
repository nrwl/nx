import 'nx/src/internal-testing-utils/mock-project-graph';

import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import libraryGenerator from '../library/library';
import componentStoryGenerator from './component-story';
import { Linter } from '@nx/eslint';

describe('react:component-story', () => {
  let appTree: Tree;
  let cmpPath = 'test-ui-lib/src/lib/test-ui-lib.tsx';
  let storyFilePath = 'test-ui-lib/src/lib/test-ui-lib.stories.tsx';

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
            componentPath: 'lib/test-ui-lib.tsx',
            project: 'test-ui-lib',
            interactionTests: true,
          });
        } catch (e) {
          expect(e.message).toContain(
            'Could not find any React component in file test-ui-lib/src/lib/test-ui-lib.tsx'
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
        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });
    });

    describe('when using plain JS components', () => {
      let storyFilePathPlain =
        'test-ui-lib/src/lib/test-ui-libplain.stories.jsx';

      beforeEach(async () => {
        appTree.write(
          'test-ui-lib/src/lib/test-ui-libplain.jsx',
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
        expect(appTree.read(storyFilePathPlain, 'utf-8')).toMatchSnapshot();
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
        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });
    });

    describe('component with props', () => {
      it('should setup controls based on the component props defined in an interface', async () => {
        appTree.write(
          cmpPath,
          `export interface TestProps {
            name: string;
            displayAge: boolean;
          }

          export const Test = (props: TestProps) => {
            return <h1>Welcome to test component, {props.name}</h1>;
          };

          export default Test;
          `
        );

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });

        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });

      it('should setup controls based on the component props defined in a literal type', async () => {
        appTree.write(
          cmpPath,
          `export type TestProps = {
            name: string;
            displayAge: boolean;
          }

          export const Test = (props: TestProps) => {
            return <h1>Welcome to test component, {props.name}</h1>;
          };

          export default Test;
          `
        );

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });

        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });

      it('should setup controls based on the component props defined in an inline literal type', async () => {
        appTree.write(
          cmpPath,
          `export const Test = (props: { name: string; displayAge: boolean }) => {
            return <h1>Welcome to test component, {props.name}</h1>;
          };

          export default Test;
          `
        );

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });

        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });

      it('should setup controls based on the component destructured props defined in an inline literal type', async () => {
        appTree.write(
          cmpPath,
          `export const Test = ({ name, displayAge }: { name: string; displayAge: boolean }) => {
            return <h1>Welcome to test component, {props.name}</h1>;
          };

          export default Test;
          `
        );

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });

        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
      });

      it('should setup controls based on the component destructured props without type', async () => {
        appTree.write(
          cmpPath,
          `export const Test = ({ name, displayAge }) => {
            return <h1>Welcome to test component, {props.name}</h1>;
          };

          export default Test;
          `
        );

        await componentStoryGenerator(appTree, {
          componentPath: 'lib/test-ui-lib.tsx',
          project: 'test-ui-lib',
        });

        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
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
        expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
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
              expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
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
              expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
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
            'test-ui-lib/src/lib/test-ui-lib--One.stories.tsx';
          const storyFilePathTwo =
            'test-ui-lib/src/lib/test-ui-lib--Two.stories.tsx';
          const storyFilePathThree =
            'test-ui-lib/src/lib/test-ui-lib--Three.stories.tsx';
          expect(appTree.read(storyFilePathOne, 'utf-8')).toMatchSnapshot();
          expect(appTree.read(storyFilePathTwo, 'utf-8')).toMatchSnapshot();
          expect(appTree.read(storyFilePathThree, 'utf-8')).toMatchSnapshot();
        });
      });
    });
  });

  describe('using eslint - not using interaction tests', () => {
    beforeEach(async () => {
      appTree = await createTestUILib('test-ui-lib');
      await componentStoryGenerator(appTree, {
        componentPath: 'lib/test-ui-lib.tsx',
        project: 'test-ui-lib',
        interactionTests: false,
      });
    });

    it('should properly set up the story', () => {
      expect(appTree.read(storyFilePath, 'utf-8')).toMatchSnapshot();
    });
  });
});

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();
  await libraryGenerator(appTree, {
    directory: libName,
    linter: Linter.EsLint,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    style: 'css',
    unitTestRunner: 'jest',
  });

  const currentWorkspaceJson = getProjects(appTree);

  const projectConfig = currentWorkspaceJson.get(libName);

  updateProjectConfiguration(appTree, libName, projectConfig);

  return appTree;
}
