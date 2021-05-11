import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readJson, writeJson, Tree } from '@nrwl/devkit';
import { useReactJsxInTsconfig } from './use-react-jsx-in-tsconfig';

describe('Update tsconfig for React apps', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it(`should add web babel preset if it does not exist`, async () => {
    writeJson(tree, 'workspace.json', {
      projects: {
        'web-app': {
          root: 'apps/web-app',
          projectType: 'application',
        },
        'react-app': {
          root: 'apps/react-app',
          projectType: 'application',
        },
        'preserve-jsx-app': {
          root: 'apps/preserve-jsx-app',
          projectType: 'application',
        },
      },
    });
    writeJson(tree, 'nx.json', {
      projects: {
        'web-app': {},
        'react-app': {},
        'preserve-jsx-app': {},
      },
    });
    writeJson(tree, 'apps/web-app/tsconfig.json', {});
    writeJson(tree, 'apps/react-app/tsconfig.json', {
      compilerOptions: { jsx: 'react' },
    });
    writeJson(tree, 'apps/preserve-jsx-app/tsconfig.json', {
      compilerOptions: { jsx: 'preserve' },
    });

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
