import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, readJson, Tree } from '@nx/devkit';
import { useReactJsxInTsconfig } from './use-react-jsx-in-tsconfig';

describe('Update tsconfig for React apps', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it(`should add web babel preset if it does not exist`, async () => {
    addProjectConfiguration(tree, 'web-app', {
      root: 'apps/web-app',
      projectType: 'application',
    });

    addProjectConfiguration(tree, 'react-app', {
      root: 'apps/react-app',
      projectType: 'application',
    });

    addProjectConfiguration(tree, 'preserve-jsx-app', {
      root: 'apps/preserve-jsx-app',
      projectType: 'application',
    });

    tree.write(
      'nx.json',
      JSON.stringify({
        projects: {
          'web-app': {},
          'react-app': {},
          'preserve-jsx-app': {},
        },
      })
    );
    tree.write('apps/web-app/tsconfig.json', JSON.stringify({}));
    tree.write(
      'apps/react-app/tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'react' } })
    );
    tree.write(
      'apps/preserve-jsx-app/tsconfig.json',
      JSON.stringify({ compilerOptions: { jsx: 'preserve' } })
    );

    await useReactJsxInTsconfig(tree);

    expect(readJson(tree, 'apps/web-app/tsconfig.json')).toEqual({});
    expect(readJson(tree, 'apps/react-app/tsconfig.json')).toMatchObject({
      compilerOptions: { jsx: 'react-jsx' },
    });
    expect(readJson(tree, 'apps/preserve-jsx-app/tsconfig.json')).toMatchObject(
      {
        compilerOptions: { jsx: 'preserve' },
      }
    );
  });
});
