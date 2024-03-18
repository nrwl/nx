import { Tree } from '@nx/devkit';
import storiesGenerator from './stories';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { applicationGenerator } from '@nx/next';
/* eslint-enable @nx/enforce-module-boundaries */
import { Linter } from '@nx/eslint';

describe('nextjs:stories for applications', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = await createTestUIApp('test-ui-app');
    tree.write(
      'test-ui-app/components/test.tsx',
      `import './test.module.scss';

      export interface TestProps {
        name: string;
      }

      export const Test = (props: TestProps) => {
        return (
          <p>Welcome to test component, {props.name}</p>
        );
      };

      export default Test;
      `
    );
  });

  it('should create the stories with interaction tests', async () => {
    await storiesGenerator(tree, {
      project: 'test-ui-app',
    });

    expect(
      tree.exists('test-ui-app/components/test.stories.tsx')
    ).toMatchSnapshot();

    const packageJson = JSON.parse(tree.read('package.json', 'utf-8'));
    expect(
      packageJson.devDependencies['@storybook/addon-interactions']
    ).toBeDefined();
    expect(packageJson.devDependencies['@storybook/test-runner']).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/testing-library']
    ).toBeDefined();
  });

  it('should create the stories without interaction tests', async () => {
    await storiesGenerator(tree, {
      project: 'test-ui-app',
      interactionTests: false,
    });

    expect(
      tree.exists('test-ui-app/components/test.stories.tsx')
    ).toMatchSnapshot();
    const packageJson = JSON.parse(tree.read('package.json', 'utf-8'));
    expect(
      packageJson.devDependencies['@storybook/addon-interactions']
    ).toBeUndefined();
    expect(
      packageJson.devDependencies['@storybook/test-runner']
    ).toBeUndefined();
    expect(
      packageJson.devDependencies['@storybook/testing-library']
    ).toBeUndefined();
  });

  it('should ignore paths', async () => {
    await storiesGenerator(tree, {
      project: 'test-ui-app',
      ignorePaths: ['test-ui-app/components/**'],
    });

    expect(tree.exists('test-ui-app/components/test.stories.tsx')).toBeFalsy();
  });
});

export async function createTestUIApp(name: string): Promise<Tree> {
  const tree = createTreeWithEmptyWorkspace();
  await applicationGenerator(tree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    name,
    projectNameAndRootFormat: 'as-provided',
  });

  return tree;
}
