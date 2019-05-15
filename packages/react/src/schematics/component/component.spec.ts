import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';
import { names } from '@nrwl/workspace/src/utils/name-utils';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';

describe('component', () => {
  let appTree: Tree;
  let projectName: string;

  beforeEach(() => {
    projectName = 'my-lib';
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = createLib(appTree, projectName);
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'component',
      { name: 'hello', project: projectName },
      appTree
    );

    expect(tree.exists('libs/my-lib/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(
      tree.exists('libs/my-lib/src/lib/hello/hello.spec.tsx')
    ).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/lib/hello/hello.css')).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, export: true },
        appTree
      );

      const indexContent = tree.read('libs/my-lib/src/index.ts').toString();

      expect(indexContent).toMatch(/lib\/hello\/hello/);
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate component files with upper case names', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, pascalCaseFiles: true },
        appTree
      );
      expect(tree.exists('libs/my-lib/src/lib/hello/Hello.tsx')).toBeTruthy();
      expect(
        tree.exists('libs/my-lib/src/lib/hello/Hello.spec.tsx')
      ).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/hello/Hello.css')).toBeTruthy();
    });
  });

  describe('--style styled-components', () => {
    it('should use styled-components as the styled API library', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, style: 'styled-components' },
        appTree
      );

      expect(
        tree.exists('libs/my-lib/src/lib/hello/hello.styled-components')
      ).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/hello/hello.tsx')).toBeTruthy();

      const content = tree
        .read('libs/my-lib/src/lib/hello/hello.tsx')
        .toString();
      expect(content).toContain('styled-components');
      expect(content).toContain('<StyledHello>');
    });

    it('should add dependencies to package.json', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, style: 'styled-components' },
        appTree
      );

      const packageJSON = readJsonInTree(tree, 'package.json');
      expect(packageJSON.dependencies['styled-components']).toBeDefined();
    });
  });

  describe('--style @emotion/styled', () => {
    it('should use @emotion/styled as the styled API library', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, style: '@emotion/styled' },
        appTree
      );

      expect(
        tree.exists('libs/my-lib/src/lib/hello/hello.@emotion/styled')
      ).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/hello/hello.tsx')).toBeTruthy();

      const content = tree
        .read('libs/my-lib/src/lib/hello/hello.tsx')
        .toString();
      expect(content).toContain('@emotion/styled');
      expect(content).toContain('<StyledHello>');
    });

    it('should add dependencies to package.json', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, style: '@emotion/styled' },
        appTree
      );

      const packageJSON = readJsonInTree(tree, 'package.json');
      expect(packageJSON.dependencies['@emotion/styled']).toBeDefined();
      expect(packageJSON.dependencies['@emotion/core']).toBeDefined();
    });
  });
});

export function createLib(tree: Tree, libName: string): Tree {
  const { fileName } = names(libName);

  tree.create(`/libs/${fileName}/src/index.ts`, `\n`);

  tree.overwrite(
    '/angular.json',
    `
{
  "projects": {
    "${libName}": {
      "root": "libs/${fileName}",
      "sourceRoot": "libs/${fileName}/src",
      "projectType": "library",
      "schematics": {}
    }
  }
}
`
  );

  return tree;
}
