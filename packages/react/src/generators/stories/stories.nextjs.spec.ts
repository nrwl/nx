import {
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import storiesGenerator from './stories';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application';
import { Linter } from '@nx/linter';

describe('nextjs:stories for applications', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = await createTestUIApp('test-ui-app');
    tree.write(
      'apps/test-ui-app/components/test.tsx',
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

  it('should create the stories', async () => {
    await storiesGenerator(tree, {
      project: 'test-ui-app',
      generateCypressSpecs: false,
    });

    expect(
      tree.exists('apps/test-ui-app/components/test.stories.tsx')
    ).toBeTruthy();
  });

  it('should ignore paths', async () => {
    await storiesGenerator(tree, {
      project: 'test-ui-app',
      generateCypressSpecs: false,
      ignorePaths: ['apps/test-ui-app/components/**'],
    });

    expect(
      tree.exists('apps/test-ui-app/components/test.stories.tsx')
    ).toBeFalsy();
  });
});

export async function createTestUIApp(name: string): Promise<Tree> {
  const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  await applicationGenerator(tree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: true,
    style: 'css',
    unitTestRunner: 'none',
    name,
    bundler: 'vite',
  });

  const config = readProjectConfiguration(tree, name);
  config.sourceRoot = config.root;
  config.targets.build.executor = '@nx/next:build';
  config.targets.serve.executor = '@nx/next:server';
  updateProjectConfiguration(tree, name, config);

  return tree;
}
