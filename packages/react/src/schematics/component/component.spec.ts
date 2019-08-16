import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic, createApp, createLib } from '../../utils/testing';
import { readJsonInTree } from '@nrwl/workspace/src/utils/ast-utils';

describe('component', () => {
  let appTree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-lib';
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = await createApp(appTree, 'my-app');
    appTree = await createLib(appTree, projectName);
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'component',
      { name: 'hello', project: projectName },
      appTree
    );

    expect(tree.exists('libs/my-lib/src/lib/hello.tsx')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/lib/hello.spec.tsx')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/lib/hello.css')).toBeTruthy();
  });

  it('should generate files for an app', async () => {
    const tree = await runSchematic(
      'component',
      { name: 'hello', project: 'my-app' },
      appTree
    );

    expect(tree.exists('apps/my-app/src/app/hello.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/app/hello.spec.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/app/hello.css')).toBeTruthy();
  });

  describe('--export', () => {
    it('should add to index.ts barrel', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, export: true },
        appTree
      );

      const indexContent = tree.read('libs/my-lib/src/index.ts').toString();

      expect(indexContent).toMatch(/lib\/hello/);
    });

    it('should not export from an app', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: 'my-app', export: true },
        appTree
      );

      const indexContent = tree.read('libs/my-lib/src/index.ts').toString();

      expect(indexContent).not.toMatch(/lib\/hello/);
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should generate component files with upper case names', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, pascalCaseFiles: true },
        appTree
      );
      expect(tree.exists('libs/my-lib/src/lib/Hello.tsx')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/Hello.spec.tsx')).toBeTruthy();
      expect(tree.exists('libs/my-lib/src/lib/Hello.css')).toBeTruthy();
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
        tree.exists('libs/my-lib/src/lib/hello.styled-components')
      ).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/hello.tsx')).toBeTruthy();

      const content = tree.read('libs/my-lib/src/lib/hello.tsx').toString();
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
        tree.exists('libs/my-lib/src/lib/hello.@emotion/styled')
      ).toBeFalsy();
      expect(tree.exists('libs/my-lib/src/lib/hello.tsx')).toBeTruthy();

      const content = tree.read('libs/my-lib/src/lib/hello.tsx').toString();
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

  describe('--routing', () => {
    it('should add routes to the component', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, routing: true },
        appTree
      );

      const content = tree.read('libs/my-lib/src/lib/hello.tsx').toString();
      expect(content).toContain('react-router-dom');
      expect(content).toMatch(/<Route\s*path="\/"/);
      expect(content).toMatch(/<Link\s*to="\/"/);

      const packageJSON = readJsonInTree(tree, 'package.json');
      expect(packageJSON.dependencies['react-router-dom']).toBeDefined();
    });
  });

  describe('--directory', () => {
    it('should create component under the directory', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'hello', project: projectName, directory: 'components' },
        appTree
      );

      expect(tree.exists('/libs/my-lib/src/lib/components/hello.tsx'));
    });

    it('should create with nested directories', async () => {
      const tree = await runSchematic(
        'component',
        { name: 'helloWorld', project: projectName, directory: 'foo' },
        appTree
      );

      expect(tree.exists('/libs/my-lib/src/lib/foo/bar/faz/hello-world.tsx'));
    });
  });
});
