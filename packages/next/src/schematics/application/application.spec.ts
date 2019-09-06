import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { readJsonInTree, NxJson } from '@nrwl/workspace';
import { runSchematic } from '../../utils/testing';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update workspace.json', async () => {
      const tree = await runSchematic('app', { name: 'myApp' }, appTree);
      const workspaceJson = readJsonInTree(tree, '/workspace.json');

      expect(workspaceJson.projects['my-app'].root).toEqual('apps/my-app');
      expect(workspaceJson.projects['my-app-e2e'].root).toEqual(
        'apps/my-app-e2e'
      );
      expect(workspaceJson.defaultProject).toEqual('my-app');
    });

    it('should update nx.json', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', tags: 'one,two' },
        appTree
      );
      const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
      expect(nxJson).toEqual({
        npmScope: 'proj',
        projects: {
          'my-app': {
            tags: ['one', 'two']
          },
          'my-app-e2e': {
            tags: []
          }
        }
      });
    });

    it('should generate files', async () => {
      const tree = await runSchematic('app', { name: 'myApp' }, appTree);
      expect(tree.exists('apps/my-app/tsconfig.json')).toBeTruthy();
      expect(tree.exists('apps/my-app/pages/index.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeTruthy();
    });
  });

  describe('--style scss', () => {
    it('should generate scss styles', async () => {
      const result = await runSchematic(
        'app',
        { name: 'myApp', style: 'scss' },
        appTree
      );
      expect(result.exists('apps/my-app/pages/index.scss')).toEqual(true);
    });
  });

  it('should setup jest with tsx support', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app'
      },
      appTree
    );

    expect(tree.readContent('apps/my-app/jest.config.js')).toContain(
      `moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],`
    );
  });

  it('should set up the nrwl next build builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app'
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.build.builder).toEqual('@nrwl/next:build');
    expect(architectConfig.build.options).toEqual({
      root: 'apps/my-app',
      outputPath: 'dist/apps/my-app'
    });
  });

  it('should set up the nrwl next dev exportr builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app'
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.serve.builder).toEqual('@nrwl/next:dev-server');
    expect(architectConfig.serve.options).toEqual({
      buildTarget: 'my-app:build',
      dev: true
    });
    expect(architectConfig.serve.configurations).toEqual({
      production: { dev: false }
    });
  });

  it('should set up the nrwl next export builder', async () => {
    const tree = await runSchematic(
      'app',
      {
        name: 'my-app'
      },
      appTree
    );
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const architectConfig = workspaceJson.projects['my-app'].architect;
    expect(architectConfig.export.builder).toEqual('@nrwl/next:export');
    expect(architectConfig.export.options).toEqual({
      buildTarget: 'my-app:build'
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', unitTestRunner: 'none' },
        appTree
      );
      expect(tree.exists('apps/my-app/specs/index.spec.tsx')).toBeFalsy();
    });
  });

  describe('--e2e-test-runner none', () => {
    it('should not generate test configuration', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', e2eTestRunner: 'none' },
        appTree
      );
      expect(tree.exists('apps/my-app-e2e')).toBeFalsy();
      const workspaceJson = readJsonInTree(tree, 'workspace.json');
      expect(workspaceJson.projects['my-app-e2e']).toBeUndefined();
    });
  });

  describe('--pascalCaseFiles', () => {
    it('should use upper case app file', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', pascalCaseFiles: true },
        appTree
      );

      expect(tree.exists('apps/my-app/pages/Index.tsx')).toBeTruthy();
      expect(tree.exists('apps/my-app/specs/Index.spec.tsx')).toBeTruthy();
    });
  });

  it('should generate functional components by default', async () => {
    const tree = await runSchematic('app', { name: 'myApp' }, appTree);

    const appContent = tree.read('apps/my-app/pages/index.tsx').toString();

    expect(appContent).not.toMatch(/extends Component/);
  });

  describe('--class-component', () => {
    it('should generate class components', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', classComponent: true },
        appTree
      );

      const appContent = tree.read('apps/my-app/pages/index.tsx').toString();

      expect(appContent).toMatch(/extends Component/);
    });
  });

  // uncomment
  // describe('--style styled-components', () => {
  //   it('should use styled-components as the styled API library', async () => {
  //     const tree = await runSchematic(
  //       'app',
  //       { name: 'myApp', style: 'styled-components' },
  //       appTree
  //     );

  //     expect(
  //       tree.exists('apps/my-app/src/app/app.styled-components')
  //     ).toBeFalsy();
  //     expect(tree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();

  //     const content = tree.read('apps/my-app/src/app/app.tsx').toString();
  //     expect(content).toContain('styled-component');
  //     expect(content).toContain('<StyledApp>');
  //   });

  //   it('should add dependencies to package.json', async () => {
  //     const tree = await runSchematic(
  //       'app',
  //       { name: 'myApp', style: 'styled-components' },
  //       appTree
  //     );

  //     const packageJSON = readJsonInTree(tree, 'package.json');
  //     expect(packageJSON.dependencies['styled-components']).toBeDefined();
  //   });
  // });

  // describe('--style @emotion/styled', () => {
  //   it('should use @emotion/styled as the styled API library', async () => {
  //     const tree = await runSchematic(
  //       'app',
  //       { name: 'myApp', style: '@emotion/styled' },
  //       appTree
  //     );

  //     expect(
  //       tree.exists('apps/my-app/src/app/app.@emotion/styled')
  //     ).toBeFalsy();
  //     expect(tree.exists('apps/my-app/src/app/app.tsx')).toBeTruthy();

  //     const content = tree.read('apps/my-app/src/app/app.tsx').toString();
  //     expect(content).toContain('@emotion/styled');
  //     expect(content).toContain('<StyledApp>');
  //   });

  //   it('should exclude styles from workspace.json', async () => {
  //     const tree = await runSchematic(
  //       'app',
  //       { name: 'myApp', style: '@emotion/styled' },
  //       appTree
  //     );

  //     const workspaceJson = readJsonInTree(tree, 'workspace.json');

  //     expect(
  //       workspaceJson.projects['my-app'].architect.build.options.styles
  //     ).toEqual([]);
  //   });

  //   it('should add dependencies to package.json', async () => {
  //     const tree = await runSchematic(
  //       'app',
  //       { name: 'myApp', style: '@emotion/styled' },
  //       appTree
  //     );

  //     const packageJSON = readJsonInTree(tree, 'package.json');
  //     expect(packageJSON.dependencies['@emotion/core']).toBeDefined();
  //     expect(packageJSON.dependencies['@emotion/styled']).toBeDefined();
  //   });
  // });

  describe('--linter=eslint', () => {
    it('should add .eslintrc and dependencies', async () => {
      const tree = await runSchematic(
        'app',
        { name: 'myApp', linter: 'eslint' },
        appTree
      );

      const eslintJson = readJsonInTree(tree, '/apps/my-app/.eslintrc');
      const packageJson = readJsonInTree(tree, '/package.json');

      expect(eslintJson.plugins).toEqual(
        expect.arrayContaining(['react', 'react-hooks'])
      );
      expect(packageJson).toMatchObject({
        devDependencies: {
          'eslint-plugin-react': expect.anything(),
          'eslint-plugin-react-hooks': expect.anything()
        }
      });
    });
  });
});
